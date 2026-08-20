import { db } from "@/lib/db"
import { parsePeriod } from "@/lib/period"
import { computeDiscountAmount, resolveApplicableDiscount, round2 } from "@/modules/discounts/discounts.calc"
import { getAssignmentsForStudents } from "@/modules/discounts/discounts.service"
import type { PaymentMethod } from "@/app/generated/prisma/client"
import type { UpdatePaymentInput } from "./payments.schema"

type UpdatePaymentData = Omit<UpdatePaymentInput, "paymentMethod"> & { paymentMethod?: PaymentMethod | null }

/** Lo que debería costar la cuota de un alumno en un período: precio de sus
 *  grupos, descuento vigente aplicado, y de qué descuento salió. */
type ExpectedCharge = {
  baseAmount: number
  amount: number
  discountAmount: number
  discountId: string | null
  discountName: string | null
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
 * - Updates the amount on PENDING/EXPIRED payments when group memberships or
 *   discounts changed.
 * - Deletes PENDING/EXPIRED payments for students no longer active or without groups.
 * PAID payments are never touched — el descuento queda congelado como se cobró.
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

  const assignments = await getAssignmentsForStudents(students.map((s) => s.id))

  // Build map studentId → cuota esperada (precio de los grupos + descuento vigente)
  const expected = new Map<string, ExpectedCharge>()
  const newRecords = students.map((student) => {
    const charge = chargeFor(
      student.groups.reduce((sum, sg) => sum + Number(sg.group.monthlyPrice), 0),
      assignments.filter((a) => a.studentId === student.id),
      periodDate,
    )
    expected.set(student.id, charge)
    return { gymId, studentId: student.id, period: periodDate, ...charge }
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
    const charge = expected.get(payment.studentId)
    if (charge === undefined) {
      // Student no longer active or has no groups → remove pending payment
      toDelete.push(payment.id)
    } else if (isStale(payment, charge)) {
      // Cambió la inscripción a grupos o el descuento → actualizar montos
      updates.push(db.payment.update({ where: { id: payment.id }, data: charge }))
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

/** Aplica al precio base el descuento vigente del alumno, si tiene alguno. */
function chargeFor(
  groupsTotal: number,
  studentAssignments: Awaited<ReturnType<typeof getAssignmentsForStudents>>,
  periodDate: Date,
): ExpectedCharge {
  const baseAmount = round2(groupsTotal)
  const applicable = resolveApplicableDiscount(
    studentAssignments.map((a) => ({
      ...a,
      discount: { ...a.discount, value: Number(a.discount.value) },
    })),
    periodDate,
  )

  if (!applicable) {
    return { baseAmount, amount: baseAmount, discountAmount: 0, discountId: null, discountName: null }
  }

  const discountAmount = computeDiscountAmount(baseAmount, applicable.discount)
  return {
    baseAmount,
    amount: round2(baseAmount - discountAmount),
    discountAmount,
    discountId: applicable.discount.id,
    discountName: applicable.discount.name,
  }
}

/** ¿La cuota guardada dejó de coincidir con lo que corresponde cobrar hoy? */
function isStale(
  payment: { baseAmount: unknown; amount: unknown; discountAmount: unknown; discountId: string | null },
  charge: ExpectedCharge,
): boolean {
  return (
    Number(payment.baseAmount) !== charge.baseAmount ||
    Number(payment.amount) !== charge.amount ||
    Number(payment.discountAmount) !== charge.discountAmount ||
    (payment.discountId ?? null) !== charge.discountId
  )
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
