import { describe, it, expect, beforeEach, vi } from "vitest"

// Igual que en payment-methods: el fake de Prisma queda vivo, así que la regla
// de mora se lee de verdad y el cálculo corre de punta a punta.
vi.mock("@/lib/db", () => import("./mocks/db"))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("@/modules/payments/payments.service", () => ({
  getPaymentsByGym: vi.fn(async () => []),
  getPaymentsByStudent: vi.fn(async () => []),
  generateMonthlyPayments: vi.fn(async () => []),
  updatePayment: vi.fn(async (id: string, data: Record<string, unknown>) => ({ id, ...data })),
  deletePayment: vi.fn(async () => undefined),
}))

import { auth } from "@/lib/auth"
import { updatePayment } from "@/modules/payments/payments.service"
import {
  DEFAULT_LATE_FEE_CONFIG,
  computeLateFee,
  dueDateFor,
  lateFeeCharges,
  lateDaysAt,
  type LateFeeConfig,
} from "@/lib/late-fee"
import { IDS, PAYMENT_FIXTURE, SESSIONS, makeRequest, paymentRow, seedTwoGyms, withParams } from "./helpers"
import { db, seed } from "./mocks/db"

const mockAuth = vi.mocked(auth)
const mockUpdatePayment = vi.mocked(updatePayment)

beforeEach(() => {
  seedTwoGyms()
  mockAuth.mockResolvedValue(SESSIONS.owner1() as never)
})

/** Regla de mora del gimnasio 1. Lo que no se pasa queda en el default (apagada). */
function seedRule(rule: Partial<LateFeeConfig>) {
  seed("lateFeeConfig", [{ id: "lfc1", gymId: IDS.gym1, ...DEFAULT_LATE_FEE_CONFIG, ...rule }])
}

function config(rule: Partial<LateFeeConfig>): LateFeeConfig {
  return { ...DEFAULT_LATE_FEE_CONFIG, enabled: true, ...rule }
}

/** El pago del fixture vence el 10/08/2026; se cobra 10 días tarde salvo que se diga otra cosa. */
const PAID_AT = new Date(2026, 7, 20, 12, 0, 0)

async function markPaid(method: string, body: Record<string, unknown> = {}) {
  const { PATCH } = await import("@/app/api/payments/[id]/route")
  return PATCH(
    makeRequest(`/api/payments/${IDS.payment1}?gymId=${IDS.gym1}`, {
      method: "PATCH",
      body: { status: "PAID", paidAt: PAID_AT.toISOString(), paymentMethod: method, ...body },
    }),
    withParams({ id: IDS.payment1 }),
  )
}

// ─── Fórmula ─────────────────────────────────────────────────────────────────

describe("lateDaysAt", () => {
  const { periodKey, dueDay } = PAYMENT_FIXTURE

  it("el alumno tiene todo el día del vencimiento para pagar", () => {
    expect(lateDaysAt(periodKey, dueDay, new Date(2026, 7, 10, 23, 0, 0))).toBe(0)
  })

  it("al día siguiente debe un día", () => {
    expect(lateDaysAt(periodKey, dueDay, new Date(2026, 7, 11, 0, 30, 0))).toBe(1)
  })

  it("cuenta los días completos de atraso", () => {
    expect(lateDaysAt(periodKey, dueDay, PAID_AT)).toBe(10)
  })

  it("pagar antes del vencimiento no genera atraso", () => {
    expect(lateDaysAt(periodKey, dueDay, new Date(2026, 7, 1))).toBe(0)
  })

  it("un día de cobro que no existe en el mes vence el último día", () => {
    // 31 de febrero no existe: la cuota vence el 28
    expect(dueDateFor("2026-02", 31)).toEqual(new Date(2026, 1, 28))
    expect(lateDaysAt("2026-02", 31, new Date(2026, 2, 1, 12, 0, 0))).toBe(1)
  })

  it("acepta el período tal como lo guarda la DB (primer día del mes en UTC)", () => {
    expect(lateDaysAt(PAYMENT_FIXTURE.period, dueDay, PAID_AT)).toBe(10)
  })
})

describe("computeLateFee", () => {
  it("con la regla apagada nunca hay recargo", () => {
    expect(computeLateFee(10000, 90, DEFAULT_LATE_FEE_CONFIG)).toBe(0)
  })

  it("dentro de la tolerancia todavía no corre", () => {
    const rule = config({ feeType: "PERCENT", feeValue: 10, graceDays: 5 })
    expect(computeLateFee(10000, 5, rule)).toBe(0)
    expect(computeLateFee(10000, 6, rule)).toBe(1000)
  })

  it("sin repetición el recargo no crece con los días", () => {
    const rule = config({ feeType: "PERCENT", feeValue: 10, repeatEveryDays: null })
    expect(computeLateFee(10000, 1, rule)).toBe(1000)
    expect(computeLateFee(10000, 45, rule)).toBe(1000)
  })

  it("repitiendo todos los días, un monto fijo se acumula", () => {
    const rule = config({ feeType: "FIXED", feeValue: 100, repeatEveryDays: 1 })
    expect(computeLateFee(10000, 10, rule)).toBe(1000)
  })

  it("repitiendo cada 7 días, una semana y un día ya son dos recargos", () => {
    const rule = config({ feeType: "PERCENT", feeValue: 5, repeatEveryDays: 7 })
    expect(computeLateFee(10000, 7, rule)).toBe(500)
    expect(computeLateFee(10000, 8, rule)).toBe(1000)
  })

  it("el tope en pesos corta la acumulación", () => {
    const rule = config({ feeType: "FIXED", feeValue: 100, repeatEveryDays: 1, maxFeeAmount: 300 })
    expect(computeLateFee(10000, 10, rule)).toBe(300)
  })

  it("el tope de veces corta la acumulación", () => {
    const rule = config({ feeType: "FIXED", feeValue: 100, repeatEveryDays: 1, maxCharges: 3 })
    expect(computeLateFee(10000, 10, rule)).toBe(300)
    expect(lateFeeCharges(10, rule)).toBe(3)
  })

  it("los dos topes conviven: gana el que corte antes", () => {
    const rule = config({ feeType: "FIXED", feeValue: 100, repeatEveryDays: 1, maxCharges: 8, maxFeeAmount: 500 })
    expect(computeLateFee(10000, 20, rule)).toBe(500)
  })

  it("un tope de veces sin repetición no cambia nada", () => {
    const rule = config({ feeType: "FIXED", feeValue: 100, repeatEveryDays: null, maxCharges: 5 })
    expect(computeLateFee(10000, 90, rule)).toBe(100)
  })

  it("una regla habilitada con monto 0 no cobra nada", () => {
    expect(computeLateFee(10000, 30, config({ feeValue: 0 }))).toBe(0)
  })

  it("el borde de la tolerancia: el último día perdonado y el primero que cobra", () => {
    const rule = config({ feeType: "FIXED", feeValue: 100, graceDays: 5, repeatEveryDays: 1 })
    expect(lateFeeCharges(5, rule)).toBe(0)
    expect(lateFeeCharges(6, rule)).toBe(1)
    expect(computeLateFee(10000, 5, rule)).toBe(0)
    expect(computeLateFee(10000, 6, rule)).toBe(100)
  })

  it("la tolerancia se descuenta antes de contar las repeticiones", () => {
    const rule = config({ feeType: "FIXED", feeValue: 100, repeatEveryDays: 1, graceDays: 5 })
    expect(computeLateFee(10000, 10, rule)).toBe(500)
  })

  it("redondea a dos decimales", () => {
    const rule = config({ feeType: "PERCENT", feeValue: 7.5 })
    expect(computeLateFee(9999.99, 1, rule)).toBe(750)
  })
})

// ─── Cobro ───────────────────────────────────────────────────────────────────

describe("Al cobrar una cuota vencida se aplica la regla de mora", () => {
  it("suma el recargo y guarda la descomposición del monto", async () => {
    seedRule({ enabled: true, feeType: "PERCENT", feeValue: 5 })

    const res = await markPaid("CASH")

    expect(res.status).toBe(200)
    expect(mockUpdatePayment).toHaveBeenCalledWith(
      IDS.payment1,
      expect.objectContaining({ amount: 10500, baseAmount: 10000, lateFee: 500, lateDays: 10, methodAdjustment: 0 }),
    )
  })

  it("la mora entra antes que el ajuste del medio: el medio ajusta lo que se cobra", async () => {
    seedRule({ enabled: true, feeType: "PERCENT", feeValue: 10 })
    seed("paymentMethodConfig", [
      { id: "cfg1", gymId: IDS.gym1, method: "CARD", enabled: true, adjustmentType: "SURCHARGE", adjustmentPercent: 10 },
    ])

    await markPaid("CARD")

    // 10000 de cuota + 1000 de mora = 11000, y sobre eso el 10% de la tarjeta
    expect(mockUpdatePayment).toHaveBeenCalledWith(
      IDS.payment1,
      expect.objectContaining({ amount: 12100, baseAmount: 10000, lateFee: 1000, methodAdjustment: 1100 }),
    )
  })

  it("los montos guardados cierran: amount = cuota + mora + ajuste del medio", async () => {
    seedRule({ enabled: true, feeType: "PERCENT", feeValue: 10 })
    seed("paymentMethodConfig", [
      { id: "cfg1", gymId: IDS.gym1, method: "CASH", enabled: true, adjustmentType: "DISCOUNT", adjustmentPercent: 5 },
    ])

    await markPaid("CASH")

    const [, fields] = mockUpdatePayment.mock.calls[0] as [string, Record<string, number>]
    // 10000 de cuota + 1000 de mora = 11000, menos el 5% de efectivo = 10450
    expect(fields).toMatchObject({ amount: 10450, baseAmount: 10000, lateFee: 1000, methodAdjustment: -550 })
    expect(fields.amount).toBe(fields.baseAmount + fields.lateFee + fields.methodAdjustment)
  })

  it("condonar una cuota impaga se guarda sin tocar los montos", async () => {
    seedRule({ enabled: true, feeType: "PERCENT", feeValue: 10 })

    const { PATCH } = await import("@/app/api/payments/[id]/route")
    const res = await PATCH(
      makeRequest(`/api/payments/${IDS.payment1}?gymId=${IDS.gym1}`, {
        method: "PATCH",
        body: { lateFeeWaived: true },
      }),
      withParams({ id: IDS.payment1 }),
    )

    // Sin medio de pago no hay nada que recalcular: solo queda la decisión tomada
    expect(res.status).toBe(200)
    expect(mockUpdatePayment).toHaveBeenCalledWith(IDS.payment1, { lateFeeWaived: true })
  })

  it("pagar en fecha no genera recargo", async () => {
    seedRule({ enabled: true, feeType: "PERCENT", feeValue: 10 })

    const { PATCH } = await import("@/app/api/payments/[id]/route")
    await PATCH(
      makeRequest(`/api/payments/${IDS.payment1}?gymId=${IDS.gym1}`, {
        method: "PATCH",
        body: { status: "PAID", paidAt: new Date(2026, 7, 8, 10, 0, 0).toISOString(), paymentMethod: "CASH" },
      }),
      withParams({ id: IDS.payment1 }),
    )

    expect(mockUpdatePayment).toHaveBeenCalledWith(
      IDS.payment1,
      expect.objectContaining({ amount: 10000, lateFee: 0, lateDays: 0 }),
    )
  })

  it("un alumno exento no paga mora aunque la regla esté activa", async () => {
    seedRule({ enabled: true, feeType: "PERCENT", feeValue: 10 })
    seed("payment", [paymentRow({ student: { dueDay: PAYMENT_FIXTURE.dueDay, lateFeeExempt: true } })])

    await markPaid("CASH")

    expect(mockUpdatePayment).toHaveBeenCalledWith(
      IDS.payment1,
      expect.objectContaining({ amount: 10000, lateFee: 0, lateDays: 10 }),
    )
  })

  it("se puede condonar el recargo de una cuota puntual", async () => {
    seedRule({ enabled: true, feeType: "PERCENT", feeValue: 10 })

    await markPaid("CASH", { lateFeeWaived: true })

    expect(mockUpdatePayment).toHaveBeenCalledWith(
      IDS.payment1,
      expect.objectContaining({ amount: 10000, lateFee: 0, lateFeeWaived: true }),
    )
  })

  it("condonar después de haber cobrado devuelve el recargo", async () => {
    seedRule({ enabled: true, feeType: "PERCENT", feeValue: 10 })
    seed("payment", [paymentRow({
      status: "PAID", amount: "11000", baseAmount: "10000", methodAdjustment: "0",
      lateFee: "1000", lateDays: 10, paymentMethod: "CASH", paidAt: PAID_AT,
    })])

    const { PATCH } = await import("@/app/api/payments/[id]/route")
    await PATCH(
      makeRequest(`/api/payments/${IDS.payment1}?gymId=${IDS.gym1}`, {
        method: "PATCH",
        body: { lateFeeWaived: true },
      }),
      withParams({ id: IDS.payment1 }),
    )

    expect(mockUpdatePayment).toHaveBeenCalledWith(
      IDS.payment1,
      expect.objectContaining({ amount: 10000, baseAmount: 10000, lateFee: 0, lateFeeWaived: true }),
    )
  })

  it("corregir el medio de un pago viejo no le suma atraso nuevo", async () => {
    // Se cobró el mismo día del vencimiento; hoy es mucho después.
    seedRule({ enabled: true, feeType: "FIXED", feeValue: 500, repeatEveryDays: 1 })
    seed("payment", [paymentRow({
      status: "PAID", amount: "10000", baseAmount: "10000", methodAdjustment: "0",
      lateFee: "0", lateDays: 0, paymentMethod: "CASH", paidAt: new Date(2026, 7, 10, 18, 0, 0),
    })])

    const { PATCH } = await import("@/app/api/payments/[id]/route")
    await PATCH(
      makeRequest(`/api/payments/${IDS.payment1}?gymId=${IDS.gym1}`, {
        method: "PATCH",
        body: { paymentMethod: "TRANSFER" },
      }),
      withParams({ id: IDS.payment1 }),
    )

    expect(mockUpdatePayment).toHaveBeenCalledWith(
      IDS.payment1,
      expect.objectContaining({ amount: 10000, lateFee: 0, lateDays: 0 }),
    )
  })

  it("al despagar se limpia la mora junto con el resto de los ajustes", async () => {
    seed("payment", [paymentRow({
      status: "PAID", amount: "11000", baseAmount: "10000", methodAdjustment: "0",
      lateFee: "1000", lateDays: 10, paymentMethod: "CASH", paidAt: PAID_AT,
    })])

    const { PATCH } = await import("@/app/api/payments/[id]/route")
    const res = await PATCH(
      makeRequest(`/api/payments/${IDS.payment1}?gymId=${IDS.gym1}`, {
        method: "PATCH",
        body: { status: "PENDING", paidAt: null },
      }),
      withParams({ id: IDS.payment1 }),
    )

    expect(res.status).toBe(200)
    expect(mockUpdatePayment).toHaveBeenCalledWith(
      IDS.payment1,
      expect.objectContaining({
        amount: 10000,
        baseAmount: null,
        lateFee: null,
        lateDays: null,
        // La condonación era de ese cobro: vuelve a estar en juego
        lateFeeWaived: false,
      }),
    )
  })

  it("una cuota que quedó condonada se vuelve a cobrar condonada", async () => {
    seedRule({ enabled: true, feeType: "PERCENT", feeValue: 10 })
    seed("payment", [paymentRow({ lateFeeWaived: true })])

    const { PATCH } = await import("@/app/api/payments/[id]/route")
    await PATCH(
      makeRequest(`/api/payments/${IDS.payment1}?gymId=${IDS.gym1}`, {
        method: "PATCH",
        body: { status: "PAID", paidAt: PAID_AT.toISOString(), paymentMethod: "CASH" },
      }),
      withParams({ id: IDS.payment1 }),
    )

    expect(mockUpdatePayment).toHaveBeenCalledWith(
      IDS.payment1,
      expect.objectContaining({ amount: 10000, lateFee: 0, lateFeeWaived: true }),
    )
  })

  it("editar una nota no le agrega mora a un pago ya cobrado", async () => {
    seedRule({ enabled: true, feeType: "PERCENT", feeValue: 10 })
    seed("payment", [paymentRow({
      status: "PAID", amount: "10000", baseAmount: "10000", methodAdjustment: "0",
      lateFee: "0", lateDays: 0, paymentMethod: "CASH", paidAt: new Date(2026, 7, 9),
    })])

    const { PATCH } = await import("@/app/api/payments/[id]/route")
    await PATCH(
      makeRequest(`/api/payments/${IDS.payment1}?gymId=${IDS.gym1}`, {
        method: "PATCH",
        body: { notes: "Pagó en dos veces" },
      }),
      withParams({ id: IDS.payment1 }),
    )

    expect(mockUpdatePayment).toHaveBeenCalledWith(IDS.payment1, { notes: "Pagó en dos veces" })
  })
})

// ─── Configuración ───────────────────────────────────────────────────────────

describe("Configuración de la mora", () => {
  it("un gimnasio sin configurar responde la regla apagada", async () => {
    const { GET } = await import("@/app/api/late-fee/route")
    const res = await GET(makeRequest(`/api/late-fee?gymId=${IDS.gym1}`))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(DEFAULT_LATE_FEE_CONFIG)
  })

  it("devuelve la regla guardada del gimnasio", async () => {
    seedRule({ enabled: true, graceDays: 3, feeType: "FIXED", feeValue: 750, repeatEveryDays: 14, maxCharges: 2 })

    const { GET } = await import("@/app/api/late-fee/route")
    const res = await GET(makeRequest(`/api/late-fee?gymId=${IDS.gym1}`))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      enabled: true,
      graceDays: 3,
      feeType: "FIXED",
      feeValue: 750,
      repeatEveryDays: 14,
      maxCharges: 2,
      maxFeeAmount: null,
    })
  })

  it("la regla de otro gimnasio no se filtra", async () => {
    seed("lateFeeConfig", [
      { id: "lfc2", gymId: IDS.gym2, ...DEFAULT_LATE_FEE_CONFIG, enabled: true, feeValue: 99 },
    ])

    const { GET } = await import("@/app/api/late-fee/route")
    const res = await GET(makeRequest(`/api/late-fee?gymId=${IDS.gym1}`))

    expect(await res.json()).toEqual(DEFAULT_LATE_FEE_CONFIG)
  })

  async function patchRule(body: Record<string, unknown>) {
    const { PATCH } = await import("@/app/api/late-fee/route")
    return PATCH(makeRequest("/api/late-fee", { method: "PATCH", body: { gymId: IDS.gym1, ...body } }))
  }

  const VALID = {
    enabled: true,
    graceDays: 5,
    feeType: "PERCENT",
    feeValue: 10,
    repeatEveryDays: 7,
    maxCharges: 4,
    maxFeeAmount: null,
  }

  it("guarda la regla del gimnasio", async () => {
    const res = await patchRule(VALID)

    expect(res.status).toBe(200)
    expect(db.lateFeeConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { gymId: IDS.gym1 }, update: VALID }),
    )
  })

  it("una regla activa sin monto no pasa la validación", async () => {
    expect((await patchRule({ ...VALID, feeValue: 0 })).status).toBe(400)
  })

  it("un porcentaje mayor a 100 no pasa la validación", async () => {
    expect((await patchRule({ ...VALID, feeValue: 150 })).status).toBe(400)
  })

  it("una tolerancia negativa no pasa la validación", async () => {
    expect((await patchRule({ ...VALID, graceDays: -1 })).status).toBe(400)
  })

  it("una repetición de menos de un día no pasa la validación", async () => {
    expect((await patchRule({ ...VALID, repeatEveryDays: 0 })).status).toBe(400)
  })

  it("un tope de veces sobre un recargo que no se repite no pasa la validación", async () => {
    expect((await patchRule({ ...VALID, repeatEveryDays: null, maxCharges: 3 })).status).toBe(400)
  })

  it("un recargo por única vez se guarda sin repetición ni tope de veces", async () => {
    const res = await patchRule({ ...VALID, repeatEveryDays: null, maxCharges: null })
    expect(res.status).toBe(200)
  })

  it("apagar la regla no exige monto", async () => {
    expect((await patchRule({ ...VALID, enabled: false, feeValue: 0 })).status).toBe(200)
  })
})
