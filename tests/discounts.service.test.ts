import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/lib/db", () => import("./mocks/db"))

import { db, seed } from "./mocks/db"
import { deleteDiscount, removeStudentDiscount } from "@/modules/discounts/discounts.service"
import { IDS, seedTwoGyms } from "./helpers"

// Borrar un descuento no puede dejar cuotas cobrando un precio que ya no existe.
// Estos tests fijan qué se toca y qué no: pendientes sí, pagadas nunca.

const PERIOD_MARCH = new Date(Date.UTC(2026, 2, 1))

/** Cuotas del alumno con el descuento aplicado: una sin cobrar y una ya cobrada. */
function seedPaymentsWithDiscount() {
  seed("payment", [
    {
      id: "cpayment0000000000000001",
      gymId: IDS.gym1,
      studentId: IDS.student1,
      period: PERIOD_MARCH,
      baseAmount: 30000,
      amount: 24000,
      discountAmount: 6000,
      discountId: IDS.discount1,
      discountName: "Hermanos",
      status: "PENDING",
    },
    {
      id: "cpayment0000000000000002",
      gymId: IDS.gym1,
      studentId: IDS.student1,
      period: new Date(Date.UTC(2026, 1, 1)),
      baseAmount: 30000,
      amount: 24000,
      discountAmount: 6000,
      discountId: IDS.discount1,
      discountName: "Hermanos",
      status: "PAID",
    },
  ])
}

/** El fake de Prisma no entiende `status: { in: [...] }`, así que el filtro por
 *  estado se aplica acá para que `findMany` devuelva lo que devolvería la DB. */
function onlyUnpaid() {
  db.payment.findMany.mockImplementation(async (args = {}) => {
    const where = (args.where ?? {}) as Record<string, unknown>
    const status = where.status as { in: string[] }
    return db.payment.__rows().filter((row) => {
      if (where.discountId && row.discountId !== where.discountId) return false
      if (where.studentId && row.studentId !== where.studentId) return false
      return status.in.includes(row.status as string)
    })
  })
}

beforeEach(() => {
  seedTwoGyms()
  seedPaymentsWithDiscount()
  onlyUnpaid()
})

describe("deleteDiscount", () => {
  it("borra el descuento — las asignaciones se van por cascade", async () => {
    await deleteDiscount(IDS.discount1)

    expect(db.discount.delete).toHaveBeenCalledWith({ where: { id: IDS.discount1 } })
  })

  it("devuelve al precio de lista las cuotas que no se cobraron", async () => {
    await deleteDiscount(IDS.discount1)

    expect(db.payment.update).toHaveBeenCalledTimes(1)
    expect(db.payment.update).toHaveBeenCalledWith({
      where: { id: "cpayment0000000000000001" },
      data: { amount: 30000, discountAmount: 0, discountId: null, discountName: null, discountOverride: null },
    })
  })

  it("no toca la cuota ya cobrada: queda como se cobró", async () => {
    await deleteDiscount(IDS.discount1)

    const touched = db.payment.update.mock.calls.map(
      ([args]) => (args as { where: { id: string } }).where.id,
    )
    expect(touched).not.toContain("cpayment0000000000000002")
  })

  it("corre en una transacción, para no borrar el descuento dejando cuotas a medio arreglar", async () => {
    await deleteDiscount(IDS.discount1)
    expect(db.$transaction).toHaveBeenCalledTimes(1)
  })
})

describe("removeStudentDiscount", () => {
  beforeEach(() => {
    seed("studentDiscount", [
      {
        id: IDS.assignment1,
        studentId: IDS.student1,
        discountId: IDS.discount1,
        validFrom: new Date(Date.UTC(2026, 0, 1)),
        validUntil: null,
      },
    ])
  })

  it("quita la asignación y recalcula las cuotas sin cobrar del alumno", async () => {
    await removeStudentDiscount(IDS.assignment1)

    expect(db.studentDiscount.delete).toHaveBeenCalledWith({ where: { id: IDS.assignment1 } })
    expect(db.payment.update).toHaveBeenCalledWith({
      where: { id: "cpayment0000000000000001" },
      data: { amount: 30000, discountAmount: 0, discountId: null, discountName: null, discountOverride: null },
    })
  })

  it("acota la vuelta atrás a la vigencia de esa asignación", async () => {
    await removeStudentDiscount(IDS.assignment1)

    const [args] = db.payment.findMany.mock.calls.at(-1) as [{ where: Record<string, unknown> }]
    expect(args.where.studentId).toBe(IDS.student1)
    expect(args.where.period).toEqual({ gte: new Date(Date.UTC(2026, 0, 1)) })
  })

  it("rechaza una asignación inexistente sin tocar nada", async () => {
    await expect(removeStudentDiscount("asignacion-fantasma")).rejects.toThrow("ASSIGNMENT_NOT_FOUND")
    expect(db.payment.update).not.toHaveBeenCalled()
  })
})
