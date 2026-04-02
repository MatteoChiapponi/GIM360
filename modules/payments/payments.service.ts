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
      select: { id: true, firstName: true, lastName: true, dueDay: true, phone1: true },
    },
  },
} as const

/**
 * Syncs payments for all active students (with groups) in a gym for the given period.
 * - Creates PENDING payments for students who don't have one yet.
 * - Updates the amount on PENDING/EXPIRED payments when group memberships changed.
 * - Deletes PENDING/EXPIRED payments for students no longer active or without groups.
 * PAID payments are never touched.
 * Returns the full payment list for that period after sync.
 */
export async function generateMonthlyPayments(gymId: string, period: string) {
  const periodDate = parsePeriod(period)

  // Fetch active students who have at least one group
  const students = await db.student.findMany({
    where: {
      gymId,
      status: { in: ["ACTIVE", "TRIAL"] },
      groups: { some: {} },
    },
    include: {
      groups: {
        include: { group: { select: { monthlyPrice: true } } },
      },
    },
  })

  // Build map studentId → expected amount from current groups
  const expectedAmounts = new Map<string, number>()
  const newRecords = students.map((student) => {
    const amount = Math.round(student.groups.reduce(
      (sum, sg) => sum + Number(sg.group.monthlyPrice),
      0
    ) * 100) / 100
    expectedAmounts.set(student.id, amount)
    return { gymId, studentId: student.id, period: periodDate, amount }
  })

  // 1. Create payments for students that don't have one yet
  if (newRecords.length > 0) {
    await db.payment.createMany({ data: newRecords, skipDuplicates: true })
  }

  // 2. Sync existing non-PAID payments: update amounts or delete stale ones
  const existingPayments = await db.payment.findMany({
    where: { gymId, period: periodDate, status: { in: ["PENDING", "EXPIRED"] } },
  })

  const updates: Promise<unknown>[] = []
  const toDelete: string[] = []

  for (const payment of existingPayments) {
    const expected = expectedAmounts.get(payment.studentId)
    if (expected === undefined) {
      // Student no longer active or has no groups → remove pending payment
      toDelete.push(payment.id)
    } else if (Number(payment.amount) !== expected) {
      // Group membership changed → update amount
      updates.push(
        db.payment.update({
          where: { id: payment.id },
          data: { amount: expected },
        })
      )
    }
  }

  if (toDelete.length > 0) {
    updates.push(
      db.payment.deleteMany({ where: { id: { in: toDelete } } })
    )
  }

  if (updates.length > 0) {
    await Promise.all(updates)
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
    const due = new Date(year, month - 1, Math.min(p.student.dueDay, lastDay), 23, 59, 59)
    if (p.status === "PENDING" && now > due) toExpire.push(p.id)
    else if (p.status === "EXPIRED" && now <= due) toRevert.push(p.id)
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
