import { db } from "@/lib/db"
import { currentPeriod, parsePeriod } from "@/lib/period"
import { rangesOverlap } from "./discounts.calc"
import type { AssignDiscountInput, CreateDiscountInput, UpdateAssignmentInput, UpdateDiscountInput } from "./discounts.schema"

const assignmentWithDiscount = {
  include: {
    discount: {
      select: { id: true, name: true, type: true, value: true, active: true, gymId: true },
    },
  },
} as const

// ─── Descuentos del gimnasio ─────────────────────────────────────────────────

/** Descuentos del gimnasio, con la cantidad de alumnos que los tiene asignados. */
export async function getDiscountsByGym(gymId: string) {
  return db.discount.findMany({
    where: { gymId },
    include: { _count: { select: { students: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  })
}

export async function getDiscountById(id: string) {
  return db.discount.findFirst({
    where: { id },
    include: { _count: { select: { students: true } } },
  })
}

export async function createDiscount(data: CreateDiscountInput) {
  return db.discount.create({ data })
}

export async function updateDiscount(id: string, data: UpdateDiscountInput) {
  return db.discount.update({ where: { id }, data })
}

/**
 * Borra un descuento y lo desasigna de todos los alumnos que lo tenían.
 *
 * Las asignaciones se van solas por cascade. Lo que hay que hacer a mano son las
 * cuotas: las que todavía no se cobraron vuelven al precio de lista en el acto,
 * sin esperar a la próxima sincronización, para que nadie cobre un descuento que
 * ya no existe. Las cuotas pagadas quedan como se cobraron — `discountId` pasa a
 * null por la FK, pero `discountName` sobrevive como testimonio de la operación.
 */
export async function deleteDiscount(id: string) {
  return db.$transaction(async (tx) => {
    await revertUnpaidPayments(tx, { discountId: id })
    return tx.discount.delete({ where: { id } })
  })
}

/** El subconjunto de Prisma que usa `revertUnpaidPayments`, para poder pasarle
 *  tanto el cliente como el `tx` de una transacción. */
type PaymentWriter = {
  payment: {
    findMany: (args: { where: Record<string, unknown> }) => Promise<{ id: string; baseAmount: unknown }[]>
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>
  }
}

/**
 * Devuelve al precio de lista las cuotas sin cobrar que tenían este descuento.
 * `amount` vuelve a `baseAmount` fila por fila — un `updateMany` no puede copiar
 * el valor de otra columna.
 */
async function revertUnpaidPayments(
  tx: PaymentWriter,
  where: { discountId: string; studentId?: string; period?: { gte: Date; lte?: Date } },
) {
  const affected = await tx.payment.findMany({
    where: { ...where, status: { in: ["PENDING", "EXPIRED"] } },
  })

  await Promise.all(
    affected.map((payment) =>
      tx.payment.update({
        where: { id: payment.id },
        data: {
          amount: payment.baseAmount,
          discountAmount: 0,
          discountId: null,
          discountName: null,
        },
      }),
    ),
  )

  return affected.length
}

// ─── Asignaciones a alumnos ──────────────────────────────────────────────────

/** Descuentos asignados a un alumno, del más reciente al más viejo. */
export async function getStudentDiscounts(studentId: string) {
  return db.studentDiscount.findMany({
    where: { studentId },
    ...assignmentWithDiscount,
    orderBy: { validFrom: "desc" },
  })
}

export async function getAssignmentById(id: string) {
  return db.studentDiscount.findFirst({ where: { id }, ...assignmentWithDiscount })
}

/** Las asignaciones de un alumno junto al descuento, para resolver el vigente. */
export async function getAssignmentsForStudents(studentIds: string[]) {
  if (studentIds.length === 0) return []
  return db.studentDiscount.findMany({
    where: { studentId: { in: studentIds } },
    ...assignmentWithDiscount,
  })
}

/** Rechaza vigencias invertidas o pisadas: así un alumno nunca tiene dos
 *  descuentos aplicables al mismo período. */
async function assertValidRange(
  studentId: string,
  validFrom: Date,
  validUntil: Date | null,
  excludeAssignmentId?: string,
) {
  if (validUntil && validUntil.getTime() < validFrom.getTime()) {
    throw new Error("INVALID_RANGE")
  }

  const existing = await db.studentDiscount.findMany({ where: { studentId } })
  const clash = existing.some(
    (a) =>
      a.id !== excludeAssignmentId &&
      rangesOverlap(validFrom, validUntil, a.validFrom, a.validUntil),
  )
  if (clash) throw new Error("OVERLAPPING_DISCOUNT")
}

export async function assignDiscountToStudent(studentId: string, data: AssignDiscountInput) {
  const discount = await db.discount.findFirst({ where: { id: data.discountId } })
  if (!discount) throw new Error("DISCOUNT_NOT_FOUND")
  if (!discount.active) throw new Error("DISCOUNT_INACTIVE")

  const validFrom = data.validFrom ? parsePeriod(data.validFrom) : currentPeriod()
  const validUntil = data.validUntil ? parsePeriod(data.validUntil) : null

  await assertValidRange(studentId, validFrom, validUntil)

  return db.studentDiscount.create({
    data: { studentId, discountId: data.discountId, validFrom, validUntil, notes: data.notes ?? null },
    ...assignmentWithDiscount,
  })
}

export async function updateStudentDiscount(id: string, data: UpdateAssignmentInput) {
  const assignment = await db.studentDiscount.findFirst({ where: { id } })
  if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND")

  const validFrom = data.validFrom ? parsePeriod(data.validFrom) : assignment.validFrom
  const validUntil =
    data.validUntil === undefined
      ? assignment.validUntil
      : data.validUntil === null
        ? null
        : parsePeriod(data.validUntil)

  await assertValidRange(assignment.studentId, validFrom, validUntil, id)

  return db.studentDiscount.update({
    where: { id },
    data: {
      validFrom,
      validUntil,
      ...(data.notes === undefined ? {} : { notes: data.notes }),
    },
    ...assignmentWithDiscount,
  })
}

/**
 * Le quita el descuento al alumno. Igual que al borrar el descuento entero, las
 * cuotas sin cobrar de los períodos que cubría vuelven al precio de lista; las
 * de otros períodos y las ya pagadas no se tocan.
 */
export async function removeStudentDiscount(id: string) {
  const assignment = await db.studentDiscount.findFirst({ where: { id } })
  if (!assignment) throw new Error("ASSIGNMENT_NOT_FOUND")

  return db.$transaction(async (tx) => {
    await revertUnpaidPayments(tx, {
      discountId: assignment.discountId,
      studentId: assignment.studentId,
      // Acotado a la vigencia: el mismo descuento puede estar asignado al alumno
      // en otro tramo del año, y ese no se toca.
      period: {
        gte: assignment.validFrom,
        ...(assignment.validUntil ? { lte: assignment.validUntil } : {}),
      },
    })
    return tx.studentDiscount.delete({ where: { id } })
  })
}
