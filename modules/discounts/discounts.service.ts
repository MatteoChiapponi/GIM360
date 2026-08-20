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
 * Borra un descuento. Falla si todavía está asignado a algún alumno: borrarlo
 * cambiaría en silencio lo que se le cobra. Para retirar uno en uso está
 * `active: false`, que lo deja fuera de las cuotas nuevas sin tocar el historial.
 */
export async function deleteDiscount(id: string) {
  const assigned = await db.studentDiscount.count({ where: { discountId: id } })
  if (assigned > 0) throw new Error("DISCOUNT_IN_USE")

  return db.discount.delete({ where: { id } })
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

export async function removeStudentDiscount(id: string) {
  return db.studentDiscount.delete({ where: { id } })
}
