import { db } from "@/lib/db"
import { expireOverduePayments } from "@/modules/payments/payments.service"
import type { MetricsQueryInput } from "../metrics.schema"

/** Parses "YYYY-MM" into the first-day-of-month Date (UTC) */
function parsePeriod(period: string): Date {
  const [year, month] = period.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function computeTrainerMonthlyMinutes(
  trainerSchedules: { weekDay: string; startTime: string; endTime: string }[]
): number {
  return trainerSchedules.reduce((total, s) => {
    const minutes = parseMinutes(s.endTime) - parseMinutes(s.startTime)
    return total + minutes * 4.33
  }, 0)
}

type HealthLabel = "Saludable" | "En desarrollo" | "Con problemas" | "Crítico"

export type HealthIndexMetrics = {
  score: number
  label: HealthLabel
  dim1Rentabilidad: { score: number; maxScore: number; weightedMarginPct: number }
  dim2Ocupacion: {
    score: number
    maxScore: number
    occupancyRate: number | null
    totalStudents: number
    totalCapacity: number
    hasGroupsWithoutCapacity: boolean
  }
  dim3Eficiencia: { score: number; maxScore: number; costRatio: number }
  dim4Ganancias: { score: number; maxScore: number; ebitdaMargin: number }
}

function getLabel(score: number): HealthLabel {
  if (score >= 80) return "Saludable"
  if (score >= 60) return "En desarrollo"
  if (score >= 40) return "Con problemas"
  return "Crítico"
}

/**
 * Returns the gym health index (0–100) broken down into 4 dimensions.
 * Only OWNER-accessible — route handler enforces authorization.
 */
export async function getHealthIndexMetrics(input: MetricsQueryInput): Promise<HealthIndexMetrics> {
  const periodDate = parsePeriod(input.period)

  await expireOverduePayments(input.gymId, input.period)

  const [groups, paidPayments, fixedExpenses] = await Promise.all([
    db.group.findMany({
      where: { gymId: input.gymId },
      include: {
        students: {
          where: { student: { status: { in: ["ACTIVE", "TRIAL"] } } },
          include: { student: { select: { id: true } } },
        },
        trainers: {
          where: { trainer: { active: true } },
          include: {
            trainer: { select: { id: true } },
            schedules: { select: { weekDay: true, startTime: true, endTime: true } },
          },
        },
        schedules: { select: { weekDays: true, startTime: true, endTime: true } },
      },
    }),

    db.payment.findMany({
      where: { gymId: input.gymId, period: periodDate, status: "PAID" },
      include: {
        student: {
          include: {
            groups: {
              include: { group: { select: { id: true, monthlyPrice: true } } },
            },
          },
        },
      },
    }),

    db.fixedExpense.findMany({
      where: { gymId: input.gymId },
      select: { amount: true },
    }),
  ])

  // ── Collected revenue per group (proportional distribution) ──────────────────
  const collectedByGroup = new Map<string, number>()

  for (const payment of paidPayments) {
    const studentGroups = payment.student.groups
    const totalMonthlyPrice = studentGroups.reduce(
      (sum, sg) => sum + Number(sg.group.monthlyPrice),
      0
    )
    if (totalMonthlyPrice === 0) continue

    for (const sg of studentGroups) {
      const share = (Number(sg.group.monthlyPrice) / totalMonthlyPrice) * Number(payment.amount)
      collectedByGroup.set(
        sg.group.id,
        Math.round(((collectedByGroup.get(sg.group.id) ?? 0) + share) * 100) / 100
      )
    }
  }

  // ── Per-group figures ────────────────────────────────────────────────────────
  const groupFigures = groups.map((group) => {
    const collectedRevenue = collectedByGroup.get(group.id) ?? 0
    const trainerCost = group.trainers.reduce((sum, tg) => {
      const rate = Number(tg.hourlyRate)
      const minutes = computeTrainerMonthlyMinutes(tg.schedules)
      return sum + rate * (minutes / 60)
    }, 0)
    return {
      groupId: group.id,
      activeStudents: group.students.length,
      maxCapacity: group.maxCapacity ?? null,
      monthlyPrice: Number(group.monthlyPrice),
      collectedRevenue,
      trainerCost,
    }
  })

  const totalCollectedRevenue = groupFigures.reduce((s, g) => s + g.collectedRevenue, 0)
  const totalTrainerCost = groupFigures.reduce((s, g) => s + g.trainerCost, 0)
  const totalFixedExpenses = fixedExpenses.reduce((s, fe) => s + Number(fe.amount), 0)
  const ebitda = totalCollectedRevenue - totalTrainerCost - totalFixedExpenses

  // ── Dim 1 — Rentabilidad (max 35) ────────────────────────────────────────────
  let dim1Score = 0
  let weightedMarginPct = 0

  if (totalCollectedRevenue > 0) {
    const weightedSum = groupFigures.reduce((sum, g) => {
      if (g.collectedRevenue <= 0) return sum
      const marginPct = (g.collectedRevenue - g.trainerCost) / g.collectedRevenue
      return sum + marginPct * g.collectedRevenue
    }, 0)
    weightedMarginPct = weightedSum / totalCollectedRevenue

    if (weightedMarginPct >= 0.5) dim1Score = 35
    else if (weightedMarginPct >= 0.4) dim1Score = 25
    else if (weightedMarginPct >= 0.3) dim1Score = 15
    else if (weightedMarginPct >= 0.2) dim1Score = 5
    else dim1Score = 0
  }

  // ── Dim 2 — Ocupación (max 35) ───────────────────────────────────────────────
  const groupsWithCapacity = groupFigures.filter((g) => g.maxCapacity !== null)
  const hasGroupsWithoutCapacity = groupFigures.length > groupsWithCapacity.length

  let dim2Score = 0
  let occupancyRate: number | null = null
  const totalStudents = groupsWithCapacity.reduce((s, g) => s + g.activeStudents, 0)
  const totalCapacity = groupsWithCapacity.reduce((s, g) => s + (g.maxCapacity ?? 0), 0)

  if (groupsWithCapacity.length > 0 && totalCapacity > 0) {
    occupancyRate = totalStudents / totalCapacity
    dim2Score = Math.round(Math.min(occupancyRate / 0.9, 1) * 35)
  }

  // ── Dim 3 — Eficiencia de costos (max 20) ────────────────────────────────────
  let dim3Score = 0
  let costRatio = 0

  if (totalCollectedRevenue > 0) {
    costRatio = (totalTrainerCost + totalFixedExpenses) / totalCollectedRevenue
    dim3Score = Math.max(0, Math.min(Math.round(((1 - costRatio) / (1 - 0.55)) * 10), 10))
  }

  // ── Dim 4 — Ganancias / EBITDA (max 20) ──────────────────────────────────────
  let dim4Score = 0
  let ebitdaMargin = 0

  if (totalCollectedRevenue > 0) {
    ebitdaMargin = ebitda / totalCollectedRevenue
    if (ebitdaMargin > 0) {
      dim4Score = Math.max(0, Math.min(Math.round((ebitdaMargin / 0.3) * 20), 20))
    }
  }

  const score = dim1Score + dim2Score + dim3Score + dim4Score

  return {
    score,
    label: getLabel(score),
    dim1Rentabilidad: { score: dim1Score, maxScore: 35, weightedMarginPct },
    dim2Ocupacion: {
      score: dim2Score,
      maxScore: 35,
      occupancyRate,
      totalStudents,
      totalCapacity,
      hasGroupsWithoutCapacity,
    },
    dim3Eficiencia: { score: dim3Score, maxScore: 10, costRatio },
    dim4Ganancias: { score: dim4Score, maxScore: 20, ebitdaMargin },
  }
}
