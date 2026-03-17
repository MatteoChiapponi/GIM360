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

/**
 * Estimates monthly hours for a set of schedules using the 4.33 weeks/month approximation.
 * Formula per schedule: sessionDuration (hrs) × weekDays.length × 4.33
 */
function computeMonthlyHours(
  schedules: { weekDays: string[]; startTime: string; endTime: string }[]
): number {
  return schedules.reduce((total, s) => {
    const durationHrs = (parseMinutes(s.endTime) - parseMinutes(s.startTime)) / 60
    return total + durationHrs * s.weekDays.length * 4.33
  }, 0)
}

/**
 * Computes actual monthly minutes for a trainer based on their individual schedule entries.
 * Each entry is a single weekDay with startTime/endTime.
 * Uses 4.33 weeks/month approximation.
 */
function computeTrainerMonthlyMinutes(
  trainerSchedules: { weekDay: string; startTime: string; endTime: string }[]
): number {
  return trainerSchedules.reduce((total, s) => {
    const minutes = parseMinutes(s.endTime) - parseMinutes(s.startTime)
    return total + minutes * 4.33
  }, 0)
}

export type GroupMetrics = {
  groupId: string
  groupName: string
  monthlyPrice: number
  activeStudents: number
  maxCapacity: number | null
  /** activeStudents / maxCapacity. null if group has no maxCapacity set. */
  occupancyRate: number | null
  /** activeStudents × monthlyPrice */
  projectedRevenue: number
  /** Sum of PAID payment amounts attributed proportionally to this group for the period */
  collectedRevenue: number
  /** Estimated monthly hours across all schedules for this group */
  monthlyHours: number
  /** Sum of hourlyRate × (trainerMinutes / 60) × 4.33 for all trainers in this group */
  trainerCost: number
  /** collectedRevenue - trainerCost */
  margin: number
}

/**
 * Returns profitability metrics per group for a given gym and billing period.
 * Only OWNER-accessible — route handler enforces authorization.
 */
export async function getGroupMetrics(input: MetricsQueryInput): Promise<GroupMetrics[]> {
  const periodDate = parsePeriod(input.period)

  // Expire overdue payments before aggregating, consistent with PaymentsView
  await expireOverduePayments(input.gymId, input.period)

  const [groups, paidPayments] = await Promise.all([
    db.group.findMany({
      where: { gymId: input.gymId },
      include: {
        students: {
          where: { student: { leftAt: null } },
          include: {
            student: { select: { id: true } },
          },
        },
        trainers: {
          where: { trainer: { active: true } },
          include: {
            trainer: { select: { id: true, name: true } },
            schedules: { select: { weekDay: true, startTime: true, endTime: true } },
          },
        },
        schedules: {
          select: { weekDays: true, startTime: true, endTime: true },
        },
      },
      orderBy: { name: "asc" },
    }),

    // Load all PAID payments for the gym/period with the student's group enrollments
    // so we can distribute each payment proportionally across the student's groups.
    db.payment.findMany({
      where: { gymId: input.gymId, period: periodDate, status: "PAID" },
      include: {
        student: {
          include: {
            groups: {
              include: {
                group: { select: { id: true, monthlyPrice: true } },
              },
            },
          },
        },
      },
    }),
  ])

  // Build a map: groupId → collected revenue (proportional share of PAID payments)
  const collectedByGroup = new Map<string, number>()

  for (const payment of paidPayments) {
    const studentGroups = payment.student.groups
    const totalMonthlyPrice = studentGroups.reduce(
      (sum, sg) => sum + Number(sg.group.monthlyPrice),
      0
    )
    if (totalMonthlyPrice === 0) continue

    for (const sg of studentGroups) {
      const share =
        (Number(sg.group.monthlyPrice) / totalMonthlyPrice) * Number(payment.amount)
      collectedByGroup.set(sg.group.id, (collectedByGroup.get(sg.group.id) ?? 0) + share)
    }
  }

  return groups.map((group) => {
    const activeStudents = group.students.length
    const monthlyPrice = Number(group.monthlyPrice)
    const monthlyHours = computeMonthlyHours(group.schedules)

    // Trainer cost: hourlyRate × (actual trainer minutes / 60) proportional
    const trainerCost = group.trainers.reduce((sum, tg) => {
      const rate = Number(tg.hourlyRate)
      const trainerMinutes = computeTrainerMonthlyMinutes(tg.schedules)
      return sum + rate * (trainerMinutes / 60)
    }, 0)

    const collectedRevenue = collectedByGroup.get(group.id) ?? 0

    return {
      groupId: group.id,
      groupName: group.name,
      monthlyPrice,
      activeStudents,
      maxCapacity: group.maxCapacity ?? null,
      occupancyRate: group.maxCapacity ? activeStudents / group.maxCapacity : null,
      projectedRevenue: activeStudents * monthlyPrice,
      collectedRevenue,
      monthlyHours,
      trainerCost,
      margin: collectedRevenue - trainerCost,
    }
  })
}
