import { describe, it, expect, afterEach, beforeEach, vi } from "vitest"

vi.mock("@/lib/db", () => import("./mocks/db"))

import { db, seed } from "./mocks/db"
import {
  assignDiscountToStudent, deleteDiscount, removeStudentDiscount, updateStudentDiscount,
} from "@/modules/discounts/discounts.service"
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
      listAmount: 30000,
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
      listAmount: 30000,
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

describe("assignDiscountToStudent", () => {
  const period = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1))

  beforeEach(() => {
    seed("studentDiscount", [])
    db.studentDiscount.create.mockResolvedValue({ id: "nueva-asignacion" })
  })

  afterEach(() => vi.useRealTimers())

  /** Los datos con los que se creó la asignación. */
  function createdData() {
    const [args] = db.studentDiscount.create.mock.calls.at(-1) as [{ data: Record<string, unknown> }]
    return args.data
  }

  it("guarda la vigencia pedida como primer día de cada mes", async () => {
    await assignDiscountToStudent(IDS.student1, {
      discountId: IDS.discount1,
      validFrom: "2026-03",
      validUntil: "2026-08",
    })

    expect(createdData()).toMatchObject({
      studentId: IDS.student1,
      discountId: IDS.discount1,
      validFrom: period(2026, 3),
      validUntil: period(2026, 8),
    })
  })

  it("sin fecha de inicio arranca el mes en curso", async () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 6, 15)))

    await assignDiscountToStudent(IDS.student1, { discountId: IDS.discount1 })

    expect(createdData()).toMatchObject({ validFrom: period(2026, 7), validUntil: null })
  })

  it("rechaza un descuento que no existe", async () => {
    await expect(
      assignDiscountToStudent(IDS.student1, { discountId: "descuento-fantasma" }),
    ).rejects.toThrow("DISCOUNT_NOT_FOUND")
    expect(db.studentDiscount.create).not.toHaveBeenCalled()
  })

  it("rechaza un descuento desactivado", async () => {
    seed("discount", [{ id: IDS.discount1, gymId: IDS.gym1, name: "Hermanos", active: false }])

    await expect(
      assignDiscountToStudent(IDS.student1, { discountId: IDS.discount1 }),
    ).rejects.toThrow("DISCOUNT_INACTIVE")
    expect(db.studentDiscount.create).not.toHaveBeenCalled()
  })

  it("rechaza una vigencia que termina antes de empezar", async () => {
    await expect(
      assignDiscountToStudent(IDS.student1, {
        discountId: IDS.discount1,
        validFrom: "2026-08",
        validUntil: "2026-03",
      }),
    ).rejects.toThrow("INVALID_RANGE")
  })

  it("rechaza pisar una vigencia que el alumno ya tiene", async () => {
    seed("studentDiscount", [
      { id: IDS.assignment1, studentId: IDS.student1, discountId: IDS.discount1, validFrom: period(2026, 1), validUntil: period(2026, 6) },
    ])

    await expect(
      assignDiscountToStudent(IDS.student1, {
        discountId: IDS.discount1,
        // Se pisa por un solo mes, y alcanza: en junio habría dos aplicables.
        validFrom: "2026-06",
        validUntil: "2026-12",
      }),
    ).rejects.toThrow("OVERLAPPING_DISCOUNT")
    expect(db.studentDiscount.create).not.toHaveBeenCalled()
  })

  it("acepta un tramo que arranca justo después del anterior", async () => {
    seed("studentDiscount", [
      { id: IDS.assignment1, studentId: IDS.student1, discountId: IDS.discount1, validFrom: period(2026, 1), validUntil: period(2026, 6) },
    ])

    await assignDiscountToStudent(IDS.student1, {
      discountId: IDS.discount1,
      validFrom: "2026-07",
      validUntil: null,
    })

    expect(createdData()).toMatchObject({ validFrom: period(2026, 7) })
  })

  it("la vigencia de otro alumno no estorba", async () => {
    seed("studentDiscount", [
      { id: IDS.assignment1, studentId: IDS.student2, discountId: IDS.discount1, validFrom: period(2026, 1), validUntil: null },
    ])

    await assignDiscountToStudent(IDS.student1, { discountId: IDS.discount1, validFrom: "2026-03" })

    expect(db.studentDiscount.create).toHaveBeenCalledTimes(1)
  })

  it("una vigencia abierta bloquea cualquier tramo posterior", async () => {
    seed("studentDiscount", [
      { id: IDS.assignment1, studentId: IDS.student1, discountId: IDS.discount1, validFrom: period(2026, 1), validUntil: null },
    ])

    await expect(
      assignDiscountToStudent(IDS.student1, { discountId: IDS.discount1, validFrom: "2030-01" }),
    ).rejects.toThrow("OVERLAPPING_DISCOUNT")
  })
})

describe("updateStudentDiscount", () => {
  const period = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1))

  beforeEach(() => {
    seed("studentDiscount", [
      { id: IDS.assignment1, studentId: IDS.student1, discountId: IDS.discount1, validFrom: period(2026, 1), validUntil: period(2026, 6) },
    ])
    db.studentDiscount.update.mockResolvedValue({ id: IDS.assignment1 })
  })

  it("puede estirar su propia vigencia sin chocar consigo misma", async () => {
    await updateStudentDiscount(IDS.assignment1, { validUntil: "2026-12" })

    const [args] = db.studentDiscount.update.mock.calls.at(-1) as [{ data: Record<string, unknown> }]
    expect(args.data).toMatchObject({ validFrom: period(2026, 1), validUntil: period(2026, 12) })
  })

  it("puede sacarle la fecha de corte", async () => {
    await updateStudentDiscount(IDS.assignment1, { validUntil: null })

    const [args] = db.studentDiscount.update.mock.calls.at(-1) as [{ data: Record<string, unknown> }]
    expect(args.data).toMatchObject({ validUntil: null })
  })

  it("rechaza estirarla encima de otra asignación del alumno", async () => {
    seed("studentDiscount", [
      { id: IDS.assignment1, studentId: IDS.student1, discountId: IDS.discount1, validFrom: period(2026, 1), validUntil: period(2026, 6) },
      { id: "cassign00000000000000002", studentId: IDS.student1, discountId: IDS.discount2, validFrom: period(2026, 7), validUntil: null },
    ])

    await expect(
      updateStudentDiscount(IDS.assignment1, { validUntil: "2026-09" }),
    ).rejects.toThrow("OVERLAPPING_DISCOUNT")
    expect(db.studentDiscount.update).not.toHaveBeenCalled()
  })

  it("rechaza una asignación inexistente", async () => {
    await expect(
      updateStudentDiscount("asignacion-fantasma", { validUntil: null }),
    ).rejects.toThrow("ASSIGNMENT_NOT_FOUND")
  })
})
