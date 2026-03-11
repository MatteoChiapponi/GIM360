import { db } from "@/lib/db"
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

export type GymMetrics = {
  gymId: string
  period: string
  /** Sum of all PAID payment amounts for the gym in the period */
  totalCollectedRevenue: number
  /** Sum of all PENDING payment amounts for the gym in the period */
  totalPendingRevenue: number
  /**
   * Estimated trainer cost: Σ (hourlyRate × monthlyHours) per active trainer per group.
   * For MONTHLY contract trainers without a salary field, hourlyRate × hours is used as an estimate.
   */
  totalTrainerCost: number
  /** Sum of all FixedExpense amounts for the gym */
  totalFixedExpenses: number
  /** totalCollectedRevenue - totalTrainerCost - totalFixedExpenses */
  ebitda: number
}

/**
 * Returns the EBITDA and cost breakdown for a gym in a given billing period.
 * Only OWNER-accessible — route handler enforces authorization.
 */
export async function getGymMetrics(input: MetricsQueryInput): Promise<GymMetrics> {
  const periodDate = parsePeriod(input.period)

  const [paidAgg, pendingAgg, trainers, fixedExpenses] = await Promise.all([
    db.payment.aggregate({
      where: { gymId: input.gymId, period: periodDate, status: "PAID" },
      _sum: { amount: true },
    }),

    db.payment.aggregate({
      where: { gymId: input.gymId, period: periodDate, status: "PENDING" },
      _sum: { amount: true },
    }),

    db.trainer.findMany({
      where: { gymId: input.gymId, active: true },
      include: {
        groups: {
          include: {
            group: {
              include: {
                schedules: {
                  select: { weekDays: true, startTime: true, endTime: true },
                },
              },
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

  const totalCollectedRevenue = Number(paidAgg._sum.amount ?? 0)
  const totalPendingRevenue = Number(pendingAgg._sum.amount ?? 0)

  const totalFixedExpenses = fixedExpenses.reduce(
    (sum, fe) => sum + Number(fe.amount),
    0
  )

  // Trainer cost: each active trainer × each group they teach × (hourlyRate × monthlyHours)
  const totalTrainerCost = trainers.reduce((trainerSum, trainer) => {
    const groupCost = trainer.groups.reduce((groupSum, tg) => {
      if (!tg.hourlyRate) return groupSum
      const monthlyHours = computeMonthlyHours(tg.group.schedules)
      return groupSum + Number(tg.hourlyRate) * monthlyHours
    }, 0)
    return trainerSum + groupCost
  }, 0)

  const ebitda = totalCollectedRevenue - totalTrainerCost - totalFixedExpenses

  return {
    gymId: input.gymId,
    period: input.period,
    totalCollectedRevenue,
    totalPendingRevenue,
    totalTrainerCost,
    totalFixedExpenses,
    ebitda,
  }
}
