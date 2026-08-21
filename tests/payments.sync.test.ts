import { describe, it, expect, afterEach, beforeEach, vi } from "vitest"

vi.mock("@/lib/db", () => import("./mocks/db"))

import { db } from "./mocks/db"
import { expireOverduePayments, generateMonthlyPayments } from "@/modules/payments/payments.service"
import { IDS } from "./helpers"

/**
 * Generar y recalcular las cuotas del mes: lo que efectivamente termina cobrando
 * el gimnasio. Es la parte del sistema donde un error se traduce directo en
 * plata mal cobrada, así que acá se fija caso por caso.
 *
 * El fake de Prisma no interpreta `status: { in: [...] }` ni los `include`, así
 * que cada test arma con `arrange` lo que devolverían esas consultas y después
 * mira qué escrituras se pidieron.
 */

const PERIOD = "2026-03"
const PERIOD_DATE = new Date(Date.UTC(2026, 2, 1))

// El día 10 vence la cuota. Los tests fijan el reloj alrededor de esa fecha.
const DUE_DAY = 10
const BEFORE_DUE = new Date(2026, 2, 5)
const AFTER_DUE = new Date(2026, 2, 12)
const AFTER_GRACE = new Date(2026, 2, 20)

type Row = Record<string, unknown>

function discount(over: Row = {}): Row {
  return {
    id: IDS.discount1,
    name: "Hermanos",
    type: "PERCENTAGE",
    value: 20,
    active: true,
    gymId: IDS.gym1,
    loseOnLatePayment: false,
    graceDays: 0,
    ...over,
  }
}

function student(over: Row = {}): Row {
  return {
    id: IDS.student1,
    dueDay: DUE_DAY,
    groups: [{ group: { monthlyPrice: 30000 } }],
    ...over,
  }
}

function assignment(over: Row = {}): Row {
  return {
    id: IDS.assignment1,
    studentId: IDS.student1,
    discountId: IDS.discount1,
    validFrom: new Date(Date.UTC(2026, 0, 1)),
    validUntil: null,
    discount: discount(),
    ...over,
  }
}

function payment(over: Row = {}): Row {
  return {
    id: "cpayment0000000000000001",
    gymId: IDS.gym1,
    studentId: IDS.student1,
    period: PERIOD_DATE,
    baseAmount: 30000,
    amount: 30000,
    discountAmount: 0,
    discountId: null,
    discountName: null,
    discountOverride: null,
    status: "PENDING",
    student: { dueDay: DUE_DAY },
    discount: null,
    ...over,
  }
}

function arrange({
  students = [student()],
  assignments = [] as Row[],
  payments = [] as Row[],
} = {}) {
  db.student.findMany.mockResolvedValue(students)
  db.studentDiscount.findMany.mockResolvedValue(assignments)
  db.payment.findMany.mockImplementation(async (args: { where?: Row } = {}) => {
    const status = args.where?.status as { in: string[] } | undefined
    return status ? payments.filter((p) => status.in.includes(p.status as string)) : payments
  })
}

/** Las cuotas que se crearon en esta corrida. */
function created(): Row[] {
  const call = db.payment.createMany.mock.calls.at(-1) as [{ data: Row[] }] | undefined
  return call?.[0].data ?? []
}

/** Lo que se actualizó de una cuota puntual, o null si no se la tocó. */
function updateFor(id: string): Row | null {
  const call = db.payment.update.mock.calls
    .map(([args]) => args as { where: { id: string }; data: Row })
    .findLast((args) => args.where.id === id)
  return call?.data ?? null
}

afterEach(() => vi.useRealTimers())

describe("generateMonthlyPayments — alta de la cuota del mes", () => {
  beforeEach(() => vi.setSystemTime(BEFORE_DUE))

  it("sin descuento cobra la suma de los grupos", async () => {
    arrange({ students: [student({ groups: [{ group: { monthlyPrice: 30000 } }, { group: { monthlyPrice: 12000 } }] })] })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(created()).toEqual([
      expect.objectContaining({
        studentId: IDS.student1,
        baseAmount: 42000,
        amount: 42000,
        discountAmount: 0,
        discountId: null,
        discountName: null,
        discountOverride: null,
      }),
    ])
  })

  it("con descuento vigente cobra el precio con descuento y guarda de cuál salió", async () => {
    arrange({ assignments: [assignment()] })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(created()[0]).toMatchObject({
      baseAmount: 30000,
      amount: 24000,
      discountAmount: 6000,
      discountId: IDS.discount1,
      discountName: "Hermanos",
    })
  })

  it("un descuento cuya vigencia no llega al período no se aplica", async () => {
    arrange({ assignments: [assignment({ validFrom: new Date(Date.UTC(2026, 5, 1)) })] })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(created()[0]).toMatchObject({ amount: 30000, discountAmount: 0, discountId: null })
  })

  it("un descuento desactivado no se aplica", async () => {
    arrange({ assignments: [assignment({ discount: discount({ active: false }) })] })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(created()[0]).toMatchObject({ amount: 30000, discountAmount: 0, discountId: null })
  })

  it("no crea cuotas si no hay alumnos activos con grupos", async () => {
    arrange({ students: [] })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(db.payment.createMany).not.toHaveBeenCalled()
  })
})

describe("generateMonthlyPayments — descuentos de pago en término", () => {
  const prontoPago = discount({ loseOnLatePayment: true, graceDays: 5 })

  it("dentro del plazo se aplica", async () => {
    vi.setSystemTime(BEFORE_DUE)
    arrange({ assignments: [assignment({ discount: prontoPago })] })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(created()[0]).toMatchObject({ amount: 24000, discountAmount: 6000 })
  })

  it("vencida pero dentro de la gracia se sigue aplicando", async () => {
    vi.setSystemTime(AFTER_DUE)
    arrange({ assignments: [assignment({ discount: prontoPago })] })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(created()[0]).toMatchObject({ amount: 24000, discountAmount: 6000 })
  })

  it("pasada la gracia se cae, pero la cuota recuerda cuál era", async () => {
    vi.setSystemTime(AFTER_GRACE)
    arrange({ assignments: [assignment({ discount: prontoPago })] })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(created()[0]).toMatchObject({
      amount: 30000,
      discountAmount: 0,
      discountId: IDS.discount1,
      discountName: "Hermanos",
    })
  })
})

describe("generateMonthlyPayments — resincronización de cuotas ya creadas", () => {
  beforeEach(() => vi.setSystemTime(BEFORE_DUE))

  it("no escribe nada si la cuota ya está como corresponde", async () => {
    arrange({
      assignments: [assignment()],
      payments: [payment({ amount: 24000, discountAmount: 6000, discountId: IDS.discount1, discountName: "Hermanos" })],
    })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(db.payment.update).not.toHaveBeenCalled()
  })

  it("actualiza la cuota cuando cambió el precio de los grupos", async () => {
    arrange({
      students: [student({ groups: [{ group: { monthlyPrice: 35000 } }] })],
      payments: [payment()],
    })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(updateFor("cpayment0000000000000001")).toMatchObject({ baseAmount: 35000, amount: 35000 })
  })

  it("aplica un descuento asignado después de generada la cuota", async () => {
    arrange({ assignments: [assignment()], payments: [payment()] })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(updateFor("cpayment0000000000000001")).toMatchObject({
      amount: 24000,
      discountAmount: 6000,
      discountName: "Hermanos",
    })
  })

  it("sigue el cambio de nombre del descuento", async () => {
    arrange({
      assignments: [assignment({ discount: discount({ name: "Hermanos y primos" }) })],
      payments: [payment({ amount: 24000, discountAmount: 6000, discountId: IDS.discount1, discountName: "Hermanos" })],
    })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(updateFor("cpayment0000000000000001")).toMatchObject({ discountName: "Hermanos y primos" })
  })

  it("borra la cuota pendiente del alumno que dejó de estar activo", async () => {
    arrange({ students: [], payments: [payment()] })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(db.payment.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["cpayment0000000000000001"] } } })
  })

  it("nunca toca una cuota cobrada: ni siquiera la mira", async () => {
    arrange({
      assignments: [assignment()],
      payments: [payment({ id: "cpayment0000000000000002", status: "PAID", amount: 30000 })],
    })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(updateFor("cpayment0000000000000002")).toBeNull()
  })
})

describe("generateMonthlyPayments — la decisión manual manda", () => {
  const prontoPago = discount({ loseOnLatePayment: true, graceDays: 5 })

  it("respeta el descuento aplicado a mano aunque el plazo haya pasado", async () => {
    vi.setSystemTime(AFTER_GRACE)
    arrange({
      assignments: [assignment({ discount: prontoPago })],
      // Ya vencida: así lo único que podría escribirse es el descuento.
      payments: [payment({
        status: "EXPIRED", amount: 24000, discountAmount: 6000,
        discountId: IDS.discount1, discountName: "Hermanos", discountOverride: true,
      })],
    })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(db.payment.update).not.toHaveBeenCalled()
  })

  it("respeta el descuento sacado a mano aunque corresponda aplicarlo", async () => {
    vi.setSystemTime(BEFORE_DUE)
    arrange({
      assignments: [assignment()],
      payments: [payment({
        amount: 30000, discountAmount: 0,
        discountId: IDS.discount1, discountName: "Hermanos", discountOverride: false,
      })],
    })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(db.payment.update).not.toHaveBeenCalled()
  })

  it("la decisión no se arrastra a otro descuento: si cambia el aplicable, vuelve al automático", async () => {
    vi.setSystemTime(BEFORE_DUE)
    const otro = discount({ id: "cdiscount000000000000009", name: "Beca", type: "FIXED_PRICE", value: 10000 })
    arrange({
      // Al alumno le sacaron "Hermanos" y le pusieron "Beca"; la cuota todavía
      // arrastra la decisión de no aplicar el anterior.
      assignments: [assignment({ discountId: otro.id, discount: otro })],
      payments: [payment({
        amount: 30000, discountAmount: 0,
        discountId: IDS.discount1, discountName: "Hermanos", discountOverride: false,
      })],
    })

    await generateMonthlyPayments(IDS.gym1, PERIOD)

    expect(updateFor("cpayment0000000000000001")).toMatchObject({
      amount: 10000,
      discountAmount: 20000,
      discountId: otro.id,
      discountName: "Beca",
      discountOverride: null,
    })
  })
})

describe("expireOverduePayments", () => {
  const PAYMENT_ID = "cpayment0000000000000001"

  function arrangePayments(rows: Row[]) {
    db.payment.findMany.mockImplementation(async (args: { where?: Row } = {}) => {
      const status = args.where?.status as { in: string[] } | undefined
      return status ? rows.filter((p) => status.in.includes(p.status as string)) : rows
    })
  }

  it("vence la cuota cuando pasó su fecha", async () => {
    vi.setSystemTime(AFTER_DUE)
    arrangePayments([payment()])

    await expireOverduePayments(IDS.gym1, PERIOD)

    expect(updateFor(PAYMENT_ID)).toEqual({ status: "EXPIRED" })
  })

  it("la devuelve a pendiente si dejó de estar vencida", async () => {
    vi.setSystemTime(BEFORE_DUE)
    arrangePayments([payment({ status: "EXPIRED" })])

    await expireOverduePayments(IDS.gym1, PERIOD)

    expect(updateFor(PAYMENT_ID)).toEqual({ status: "PENDING" })
  })

  it("no escribe si el estado ya es el correcto", async () => {
    vi.setSystemTime(BEFORE_DUE)
    arrangePayments([payment()])

    await expireOverduePayments(IDS.gym1, PERIOD)

    expect(db.payment.update).not.toHaveBeenCalled()
  })

  it("baja el descuento de pago en término al pasar su plazo, en el mismo paso que el estado", async () => {
    vi.setSystemTime(AFTER_GRACE)
    arrangePayments([payment({
      amount: 24000, discountAmount: 6000,
      discountId: IDS.discount1, discountName: "Hermanos",
      discount: { type: "PERCENTAGE", value: 20, loseOnLatePayment: true, graceDays: 5 },
    })])

    await expireOverduePayments(IDS.gym1, PERIOD)

    expect(updateFor(PAYMENT_ID)).toEqual({ status: "EXPIRED", discountAmount: 0, amount: 30000 })
  })

  it("mantiene el descuento mientras dure la gracia, aunque la cuota ya figure vencida", async () => {
    vi.setSystemTime(AFTER_DUE)
    arrangePayments([payment({
      amount: 24000, discountAmount: 6000,
      discountId: IDS.discount1, discountName: "Hermanos",
      discount: { type: "PERCENTAGE", value: 20, loseOnLatePayment: true, graceDays: 5 },
    })])

    await expireOverduePayments(IDS.gym1, PERIOD)

    // Cambia el estado, pero el monto no se toca.
    expect(updateFor(PAYMENT_ID)).toEqual({ status: "EXPIRED" })
  })

  it("devuelve el descuento si la cuota deja de estar pasada de plazo", async () => {
    vi.setSystemTime(BEFORE_DUE)
    arrangePayments([payment({
      status: "EXPIRED", amount: 30000, discountAmount: 0,
      discountId: IDS.discount1, discountName: "Hermanos",
      discount: { type: "PERCENTAGE", value: 20, loseOnLatePayment: true, graceDays: 0 },
    })])

    await expireOverduePayments(IDS.gym1, PERIOD)

    expect(updateFor(PAYMENT_ID)).toEqual({ status: "PENDING", discountAmount: 6000, amount: 24000 })
  })

  it("no le saca el descuento a quien lo tiene aplicado a mano", async () => {
    vi.setSystemTime(AFTER_GRACE)
    arrangePayments([payment({
      status: "EXPIRED", amount: 24000, discountAmount: 6000, discountOverride: true,
      discountId: IDS.discount1, discountName: "Hermanos",
      discount: { type: "PERCENTAGE", value: 20, loseOnLatePayment: true, graceDays: 5 },
    })])

    await expireOverduePayments(IDS.gym1, PERIOD)

    expect(db.payment.update).not.toHaveBeenCalled()
  })

  it("un descuento común no se cae por vencimiento", async () => {
    vi.setSystemTime(AFTER_GRACE)
    arrangePayments([payment({
      status: "EXPIRED", amount: 24000, discountAmount: 6000,
      discountId: IDS.discount1, discountName: "Hermanos",
      discount: { type: "PERCENTAGE", value: 20, loseOnLatePayment: false, graceDays: 0 },
    })])

    await expireOverduePayments(IDS.gym1, PERIOD)

    expect(db.payment.update).not.toHaveBeenCalled()
  })
})
