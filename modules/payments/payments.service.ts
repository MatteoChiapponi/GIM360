import { db } from "@/lib/db"
import { parsePeriod } from "@/lib/period"
import { computeDiscountAmount, discountApplies, resolveApplicableDiscount, round2 } from "@/modules/discounts/discounts.calc"
import { dueDateFor, pastDiscountDeadline } from "./payments.calc"
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
  const now = new Date()

  /** Cuánto le toca pagar a este alumno, respetando la decisión manual que
   *  tenga la cuota (`override`) por encima de la regla automática. */
  const chargeForStudent = (student: (typeof students)[number], override: boolean | null) =>
    chargeFor(
      student.groups.reduce((sum, sg) => sum + Number(sg.group.monthlyPrice), 0),
      assignments.filter((a) => a.studentId === student.id),
      periodDate,
      (graceDays: number) => pastDiscountDeadline(period, student.dueDay, graceDays, now),
      override,
    )

  const studentsById = new Map(students.map((student) => [student.id, student]))
  const newRecords = students.map((student) => ({
    gymId,
    studentId: student.id,
    period: periodDate,
    ...chargeForStudent(student, null),
  }))

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
    const student = studentsById.get(payment.studentId)
    if (student === undefined) {
      // Student no longer active or has no groups → remove pending payment
      toDelete.push(payment.id)
      continue
    }

    const charge = chargeForStudent(student, payment.discountOverride)
    if (isStale(payment, charge)) {
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

/**
 * Aplica al precio base el descuento vigente del alumno, si tiene alguno.
 *
 * Quién decide: si la cuota trae una decisión manual (`override`), manda esa —
 * el operario puede perdonar la mora o sacar el descuento a mano. Si no, manda
 * la regla: los descuentos de "pago en término" no valen sobre una cuota vencida.
 */
function chargeFor(
  groupsTotal: number,
  studentAssignments: Awaited<ReturnType<typeof getAssignmentsForStudents>>,
  periodDate: Date,
  /** El plazo depende de los días de gracia del descuento, que recién se
   *  conocen una vez resuelto cuál corresponde. */
  isPastDeadline: (graceDays: number) => boolean,
  override: boolean | null,
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

  // El descuento que no se aplica conserva el vínculo con `discountAmount` en
  // cero: así la vista puede decir cuál se perdió, y si la cuota deja de estar
  // vencida se recalcula sola contra la asignación, que sigue intacta.
  const discountAmount = (override ?? discountApplies(applicable.discount, isPastDeadline(applicable.discount.graceDays)))
    ? computeDiscountAmount(baseAmount, applicable.discount)
    : 0

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

/**
 * Recalcula el estado de las cuotas no cobradas de un período: PENDING → EXPIRED
 * cuando pasó el vencimiento, y de vuelta a PENDING si dejó de estar vencida
 * (por ejemplo, si se corrigió el día de cobro del alumno).
 *
 * Los descuentos de "pago en término" se caen acá junto con el estado, y vuelven
 * si la cuota deja de estar vencida. Se guarda el vínculo con el descuento y se
 * pone `discountAmount` en cero, así la vista puede mostrar cuál se perdió.
 */
export async function expireOverduePayments(gymId: string, period: string) {
  const periodDate = parsePeriod(period)
  const now = new Date()

  const payments = await db.payment.findMany({
    where: { gymId, period: periodDate, status: { in: ["PENDING", "EXPIRED"] } },
    include: {
      student: { select: { dueDay: true } },
      discount: { select: { type: true, value: true, loseOnLatePayment: true, graceDays: true } },
    },
  })

  const updates = payments.flatMap((payment) => {
    const data: Record<string, unknown> = {}

    // El estado de la cuota se mide contra su vencimiento; el descuento, contra
    // su propio plazo (vencimiento + días de gracia). Son dos relojes distintos.
    const status = now > dueDateFor(period, payment.student.dueDay) ? "EXPIRED" : "PENDING"
    if (payment.status !== status) data.status = status

    if (payment.discount?.loseOnLatePayment) {
      const baseAmount = Number(payment.baseAmount)
      const pastDeadline = pastDiscountDeadline(period, payment.student.dueDay, payment.discount.graceDays, now)
      const discountAmount = (payment.discountOverride ?? discountApplies(payment.discount, pastDeadline))
        ? computeDiscountAmount(baseAmount, { ...payment.discount, value: Number(payment.discount.value) })
        : 0

      if (Number(payment.discountAmount) !== discountAmount) {
        data.discountAmount = discountAmount
        data.amount = round2(baseAmount - discountAmount)
      }
    }

    return Object.keys(data).length > 0 ? [db.payment.update({ where: { id: payment.id }, data })] : []
  })

  if (updates.length > 0) await Promise.all(updates)
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

/**
 * Aplica o saca a mano el descuento de una cuota puntual.
 *
 * `override`: true = aplicarlo aunque la regla lo hubiera sacado (perdonarle la
 * mora), false = no aplicarlo aunque corresponda, null = volver al automático.
 *
 * La decisión queda guardada en la cuota, así que sobrevive a las
 * sincronizaciones: nadie le pisa el criterio al operario. El monto lo recalcula
 * el servidor a partir de `baseAmount` y del descuento de la cuota — no se
 * confía en un monto mandado desde el cliente.
 */
export async function setDiscountOverride(id: string, override: boolean | null) {
  const payment = await db.payment.findFirst({
    where: { id },
    include: {
      student: { select: { dueDay: true } },
      discount: { select: { type: true, value: true, loseOnLatePayment: true, graceDays: true } },
    },
  })

  if (!payment) throw new Error("PAYMENT_NOT_FOUND")
  // Una cuota cobrada ya es historia: para corregirla hay que desmarcarla primero.
  if (payment.status === "PAID") throw new Error("PAYMENT_ALREADY_PAID")
  if (!payment.discount) throw new Error("PAYMENT_WITHOUT_DISCOUNT")

  const baseAmount = Number(payment.baseAmount)
  const pastDeadline = pastDiscountDeadline(
    payment.period.toISOString().slice(0, 7),
    payment.student.dueDay,
    payment.discount.graceDays,
  )
  const applies = override ?? discountApplies(payment.discount, pastDeadline)
  const discountAmount = applies
    ? computeDiscountAmount(baseAmount, { ...payment.discount, value: Number(payment.discount.value) })
    : 0

  return db.payment.update({
    where: { id },
    data: {
      discountOverride: override,
      discountAmount,
      amount: round2(baseAmount - discountAmount),
    },
    ...paymentWithStudent,
  })
}

/** Deletes a payment */
export async function deletePayment(id: string) {
  return db.payment.delete({ where: { id } })
}
