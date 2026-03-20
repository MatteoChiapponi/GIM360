import { db } from "@/lib/db"
import type { PaymentMethod } from "@/app/generated/prisma/client"
import type { UpdatePaymentInput } from "./payments.schema"

type UpdatePaymentData = Omit<UpdatePaymentInput, "paymentMethod"> & { paymentMethod?: PaymentMethod | null }

/** Parses "YYYY-MM" into the first-day-of-month Date (UTC) */
function parsePeriod(period: string): Date {
  const [year, month] = period.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

const paymentWithStudent = {
  include: {
    student: {
      select: { id: true, firstName: true, lastName: true, dueDay: true },
    },
  },
} as const

/**
 * Generates PENDING payments for all active students (with groups) in a gym
 * for the given period. Idempotent — existing records are skipped.
 * Returns the full payment list for that period after generation.
 */
export async function generateMonthlyPayments(gymId: string, period: string) {
  const periodDate = parsePeriod(period)

  // Fetch active students who have at least one group
  const students = await db.student.findMany({
    where: {
      gymId,
      status: { in: ["ACTIVO", "PRUEBA"] },
      groups: { some: {} },
    },
    include: {
      groups: {
        include: { group: { select: { monthlyPrice: true } } },
      },
    },
  })

  const records = students.map((student) => {
    const amount = student.groups.reduce(
      (sum, sg) => sum + Number(sg.group.monthlyPrice),
      0
    )
    return { gymId, studentId: student.id, period: periodDate, amount }
  })

  if (records.length > 0) {
    await db.payment.createMany({ data: records, skipDuplicates: true })
  }

  return getPaymentsByGym(gymId, period)
}

/** Recalculates PENDING/EXPIRED status for all non-PAID payments in a period.
 *  PENDING → EXPIRED if due date passed. EXPIRED → PENDING if due date hasn't passed yet. */
export async function expireOverduePayments(gymId: string, period: string) {
  const periodDate = parsePeriod(period)
  const [year, month] = period.split("-").map(Number)
  const now = new Date()
  const lastDay = new Date(year, month, 0).getDate()

  const payments = await db.payment.findMany({
    where: { gymId, period: periodDate, status: { in: ["PENDING", "EXPIRED"] } },
    include: { student: { select: { dueDay: true } } },
  })

  const toExpire: string[] = []
  const toRevert: string[] = []

  for (const p of payments) {
    const due = new Date(year, month - 1, Math.min(p.student.dueDay, lastDay))
    if (p.status === "PENDING" && due < now) toExpire.push(p.id)
    else if (p.status === "EXPIRED" && due >= now) toRevert.push(p.id)
  }

  await Promise.all([
    toExpire.length > 0 && db.payment.updateMany({
      where: { id: { in: toExpire } },
      data: { status: "EXPIRED" },
    }),
    toRevert.length > 0 && db.payment.updateMany({
      where: { id: { in: toRevert } },
      data: { status: "PENDING" },
    }),
  ])
}

/** Returns all payments for a gym in a given period, with student info.
 *  Automatically expires overdue PENDING payments before returning. */
export async function getPaymentsByGym(gymId: string, period: string) {
  const periodDate = parsePeriod(period)
  await expireOverduePayments(gymId, period)
  return db.payment.findMany({
    where: { gymId, period: periodDate },
    ...paymentWithStudent,
    orderBy: { createdAt: "asc" },
  })
}

/** Returns full payment history for a student */
export async function getPaymentsByStudent(studentId: string) {
  return db.payment.findMany({
    where: { studentId },
    orderBy: { period: "desc" },
  })
}

/** Updates a payment (status, paidAt, notes, amount, paymentMethod) */
export async function updatePayment(id: string, data: UpdatePaymentData) {
  return db.payment.update({
    where: { id },
    data,
    ...paymentWithStudent,
  })
}

/** Deletes a payment */
export async function deletePayment(id: string) {
  return db.payment.delete({ where: { id } })
}
