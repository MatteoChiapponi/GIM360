import { describe, it, expect, beforeEach, vi } from "vitest"

// Igual que en payment-methods y late-fee: el fake de Prisma queda vivo, así que
// el pago guardado, la config del medio y la regla de mora se leen de verdad y el
// ajuste manual se calcula contra el mismo total que cobra el backend.
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
import { createCashClosing } from "@/modules/cash-closings/cash-closings.service"
import { DEFAULT_LATE_FEE_CONFIG, type LateFeeConfig } from "@/lib/late-fee"
import { ruledCharge } from "@/lib/charge"
import { round2 } from "@/lib/money"
import { IDS, SESSIONS, makeRequest, paymentRow, seedTwoGyms, withParams } from "./helpers"
import { db, seed } from "./mocks/db"

const mockAuth = vi.mocked(auth)
const mockUpdatePayment = vi.mocked(updatePayment)

beforeEach(() => {
  seedTwoGyms()
  mockAuth.mockResolvedValue(SESSIONS.owner1() as never)
})

/** El pago del fixture vence el 10/08/2026; salvo que se diga otra cosa se cobra en fecha. */
const PAID_AT = new Date(2026, 7, 5, 12, 0, 0)

/** Diez días después del vencimiento, para los casos con mora corrida. */
const PAID_LATE = new Date(2026, 7, 20, 12, 0, 0)

function seedConfigs(rows: Record<string, unknown>[]) {
  seed("paymentMethodConfig", rows.map((r, i) => ({ id: `cfg${i}`, gymId: IDS.gym1, ...r })))
}

function seedRule(rule: Partial<LateFeeConfig>) {
  seed("lateFeeConfig", [{ id: "lfc1", gymId: IDS.gym1, ...DEFAULT_LATE_FEE_CONFIG, ...rule }])
}

async function patch(body: Record<string, unknown>) {
  const { PATCH } = await import("@/app/api/payments/[id]/route")
  return PATCH(
    makeRequest(`/api/payments/${IDS.payment1}?gymId=${IDS.gym1}`, { method: "PATCH", body }),
    withParams({ id: IDS.payment1 }),
  )
}

/** Cobra el pago del fixture; `chargedAmount` es el monto que se cobró de verdad. */
async function markPaid(body: Record<string, unknown> = {}) {
  return patch({ status: "PAID", paidAt: PAID_AT.toISOString(), paymentMethod: "CASH", ...body })
}

/** Los campos con los que se llamó al update. */
function savedFields(): Record<string, number | string | null | boolean> {
  return mockUpdatePayment.mock.calls[0][1] as Record<string, number | string | null | boolean>
}

/**
 * Lo que tiene que cumplir todo cobro, se le haya tocado el monto o no.
 *
 * Van juntas y las corre cada caso, no solo el que se acordó de escribirlas: los
 * `toMatchObject` de acá abajo dejan pasar cualquier campo que el test no nombre,
 * y en plata el campo que nadie mira es justo el que descuadra la caja.
 */
function expectSoundCharge() {
  const f = savedFields()
  const parts = ["baseAmount", "lateFee", "methodAdjustment", "manualAdjustment"] as const
  const sum = parts.reduce((acc, k) => acc + Number(f[k]), 0)

  // La descomposición cierra: lo cobrado es exactamente la suma de sus partes
  expect(f.amount).toBe(round2(sum))
  // Nunca se cobra en negativo
  expect(Number(f.amount)).toBeGreaterThanOrEqual(0)
  // El motivo solo existe si hay un ajuste que explicar
  if (f.manualAdjustment === 0) expect(f.manualAdjustmentReason).toBeNull()
  // `chargedAmount` es la intención de quien cobra, no una columna: si llegara
  // hasta el update, Prisma lo rechazaría en producción y acá no se vería.
  expect(f).not.toHaveProperty("chargedAmount")
}

// ─── Cobro con el monto ajustado a mano ──────────────────────────────────────

describe("Quien cobra puede ajustar el monto de la cuota", () => {
  it("sin tocar nada no hay ajuste manual", async () => {
    const res = await markPaid({ chargedAmount: null })

    expect(res.status).toBe(200)
    expect(savedFields()).toMatchObject({
      amount: 10000,
      baseAmount: 10000,
      manualAdjustment: 0,
      manualAdjustmentReason: null,
    })
    expectSoundCharge()
  })

  it("redondear para abajo se guarda como un ajuste negativo", async () => {
    await markPaid({ chargedAmount: 9500 })

    expect(savedFields()).toMatchObject({ amount: 9500, baseAmount: 10000, manualAdjustment: -500 })
    expectSoundCharge()
  })

  it("cobrar de más se guarda como un ajuste positivo", async () => {
    await markPaid({ chargedAmount: 10500 })

    expect(savedFields()).toMatchObject({ amount: 10500, baseAmount: 10000, manualAdjustment: 500 })
    expectSoundCharge()
  })

  it("el motivo del ajuste queda registrado", async () => {
    await markPaid({ chargedAmount: 9950, manualAdjustmentReason: "  Redondeo  " })

    expect(savedFields()).toMatchObject({ manualAdjustment: -50, manualAdjustmentReason: "Redondeo" })
    expectSoundCharge()
  })

  it("un motivo sin ajuste no se guarda: no hay nada que explicar", async () => {
    await markPaid({ chargedAmount: 10000, manualAdjustmentReason: "Redondeo" })

    expect(savedFields()).toMatchObject({ manualAdjustment: 0, manualAdjustmentReason: null })
    expectSoundCharge()
  })

  it("cobrar cero deja el monto en cero y el ajuste se lleva toda la cuota", async () => {
    await markPaid({ chargedAmount: 0 })

    expect(savedFields()).toMatchObject({ amount: 0, baseAmount: 10000, manualAdjustment: -10000 })
    expectSoundCharge()
  })

  it("la recepcionista también puede ajustar el monto", async () => {
    mockAuth.mockResolvedValue(SESSIONS.receptionist1() as never)

    const res = await markPaid({ chargedAmount: 9800 })

    expect(res.status).toBe(200)
    expect(savedFields()).toMatchObject({ amount: 9800, manualAdjustment: -200 })
    expectSoundCharge()
  })

  it("un monto negativo no se acepta", async () => {
    const res = await markPaid({ chargedAmount: -100 })

    expect(res.status).toBe(400)
    expect(mockUpdatePayment).not.toHaveBeenCalled()
  })

  it("los centavos del ajuste se redondean a dos decimales", async () => {
    await markPaid({ chargedAmount: 9999.99 })

    expect(savedFields()).toMatchObject({ amount: 9999.99, manualAdjustment: -0.01 })
    expectSoundCharge()
  })

  it("no se puede fijar el monto de una cuota que no se está cobrando", async () => {
    // Sin medio de pago no hay cobro: contestar 200 sería mentir sobre lo guardado
    const res = await patch({ chargedAmount: 9500 })

    expect(res.status).toBe(400)
    expect(mockUpdatePayment).not.toHaveBeenCalled()
  })

  it("un pago ya verificado no se puede ajustar: la caja está cerrada", async () => {
    seed("payment", [paymentRow({ status: "PAID", verified: true, paymentMethod: "CASH", paidAt: PAID_AT })])

    const res = await patch({ chargedAmount: 9500 })

    expect(res.status).toBe(409)
    expect(mockUpdatePayment).not.toHaveBeenCalled()
  })
})

// ─── El orden de las reglas ──────────────────────────────────────────────────

describe("El ajuste manual se mide contra el total que dan las reglas del gimnasio", () => {
  it("el ajuste es la diferencia contra la cuota con mora y con el medio ya aplicados", async () => {
    // Vence el 10 y se cobra el 20: 10 días de atraso
    seedRule({ enabled: true, feeType: "PERCENT", feeValue: 10 })
    seedConfigs([{ method: "CARD", enabled: true, adjustmentType: "SURCHARGE", adjustmentPercent: 10 }])

    // 10000 de cuota + 1000 de mora = 11000, y sobre eso el 10% de tarjeta = 12100
    await markPaid({
      paymentMethod: "CARD",
      paidAt: PAID_LATE.toISOString(),
      chargedAmount: 12000,
    })

    expect(savedFields()).toMatchObject({
      amount: 12000,
      baseAmount: 10000,
      lateFee: 1000,
      methodAdjustment: 1100,
      manualAdjustment: -100,
    })
    expectSoundCharge()
  })

  it("la vista previa del modal y lo que se termina cobrando dan el mismo número", async () => {
    seedRule({ enabled: true, feeType: "PERCENT", feeValue: 10 })
    const card = { adjustmentType: "SURCHARGE", adjustmentPercent: 10 } as const
    seedConfigs([{ method: "CARD", enabled: true, ...card }])

    // El total que el modal le muestra a quien cobra sale de `ruledCharge`; es la
    // misma función que usa el backend, así que este test falla si alguien cambia
    // el orden de las reglas de un solo lado.
    const preview = ruledCharge(10000, 1000, card)

    await markPaid({ paymentMethod: "CARD", paidAt: PAID_LATE.toISOString(), chargedAmount: null })

    expect(savedFields()).toMatchObject({
      amount: preview.total,
      methodAdjustment: preview.methodAdjustment,
    })
    expectSoundCharge()
  })

  it("condonar la mora mueve el total contra el que se mide el ajuste", async () => {
    seedRule({ enabled: true, feeType: "PERCENT", feeValue: 10 })

    await markPaid({
      paidAt: PAID_LATE.toISOString(),
      lateFeeWaived: true,
      chargedAmount: 9500,
    })

    // Sin mora el total es la cuota limpia: el ajuste son 500, no 1500
    expect(savedFields()).toMatchObject({ lateFee: 0, manualAdjustment: -500, amount: 9500 })
    expectSoundCharge()
  })
})

// ─── Qué pasa con un ajuste ya guardado ──────────────────────────────────────

describe("Un ajuste ya guardado sobrevive a las ediciones que no lo tocan", () => {
  const paid = {
    status: "PAID",
    amount: "9500",
    baseAmount: "10000",
    methodAdjustment: "0",
    manualAdjustment: "-500",
    manualAdjustmentReason: "Redondeo",
    paymentMethod: "CASH",
    paidAt: PAID_AT,
  }

  it("corregirle el medio de pago no borra el redondeo que se le hizo al alumno", async () => {
    seed("payment", [paymentRow(paid)])
    seedConfigs([{ method: "CARD", enabled: true, adjustmentType: "SURCHARGE", adjustmentPercent: 10 }])

    await patch({ paymentMethod: "CARD" })

    // 11000 según la tarjeta, menos los 500 que se le habían redondeado
    expect(savedFields()).toMatchObject({ amount: 10500, methodAdjustment: 1000, manualAdjustment: -500 })
    expectSoundCharge()
  })

  it("editar una nota no recalcula nada", async () => {
    seed("payment", [paymentRow(paid)])

    await patch({ notes: "Pagó en dos veces" })

    expect(mockUpdatePayment).toHaveBeenCalledWith(IDS.payment1, { notes: "Pagó en dos veces" })
  })

  it("mandar chargedAmount null borra el ajuste y vuelve al monto calculado", async () => {
    seed("payment", [paymentRow(paid)])

    await patch({ chargedAmount: null })

    expect(savedFields()).toMatchObject({
      amount: 10000,
      manualAdjustment: 0,
      manualAdjustmentReason: null,
    })
    expectSoundCharge()
  })

  it("si el ajuste se queda en cero el motivo se va con él", async () => {
    seed("payment", [paymentRow(paid)])
    // Un descuento del 100% deja el total en 0, y el piso se come el ajuste:
    // el motivo guardado ya no describe nada.
    seedConfigs([{ method: "CASH", enabled: true, adjustmentType: "DISCOUNT", adjustmentPercent: 100 }])

    await patch({ paymentMethod: "CASH" })

    expect(savedFields()).toMatchObject({
      amount: 0,
      manualAdjustment: 0,
      manualAdjustmentReason: null,
    })
    expectSoundCharge()
  })

  it("la recepcionista puede cancelar un cobro y el ajuste se va con él", async () => {
    seed("payment", [paymentRow(paid)])
    mockAuth.mockResolvedValue(SESSIONS.receptionist1() as never)

    const res = await patch({ status: "PENDING", paidAt: null })

    expect(res.status).toBe(200)
    expect(savedFields()).toMatchObject({
      amount: 10000,
      paymentMethod: null,
      manualAdjustment: null,
      manualAdjustmentReason: null,
    })
  })

  it("una cuota ya verificada no se puede cancelar: la caja está cerrada", async () => {
    seed("payment", [paymentRow({ ...paid, verified: true })])
    mockAuth.mockResolvedValue(SESSIONS.receptionist1() as never)

    const res = await patch({ status: "PENDING", paidAt: null })

    expect(res.status).toBe(409)
    expect(mockUpdatePayment).not.toHaveBeenCalled()
  })

  it("despagar limpia el ajuste junto con el resto", async () => {
    seed("payment", [paymentRow(paid)])

    await patch({ status: "PENDING" })

    expect(savedFields()).toMatchObject({
      amount: 10000,
      baseAmount: null,
      methodAdjustment: null,
      lateFee: null,
      manualAdjustment: null,
      manualAdjustmentReason: null,
    })
  })
})

// ─── Cierre de caja ──────────────────────────────────────────────────────────

describe("El cierre de caja registra lo que se ajustó a mano", () => {
  beforeEach(() => {
    db.cashClosing.create.mockResolvedValue({ id: "cclosing1" } as never)
  })

  function paidPayment(overrides: Record<string, unknown>) {
    return paymentRow({
      status: "PAID",
      verified: false,
      paidAt: PAID_AT,
      paymentMethod: "CASH",
      ...overrides,
    })
  }

  it("suma los ajustes aparte, sin sacarlos del total cobrado", async () => {
    seed("payment", [
      paidPayment({ id: "cpayment0000000000000001", amount: "9500", manualAdjustment: "-500" }),
      paidPayment({ id: "cpayment0000000000000002", amount: "10200", manualAdjustment: "200" }),
      paidPayment({ id: "cpayment0000000000000003", amount: "10000", manualAdjustment: null }),
    ])

    await createCashClosing({ gymId: IDS.gym1 })

    expect(db.cashClosing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalCollected: 29700,
          cashTotal: 29700,
          adjustmentsCount: 2,
          adjustmentsTotal: -300,
        }),
      }),
    )
  })

  it("un pago excluido del cierre no suma su ajuste", async () => {
    seed("payment", [
      paidPayment({ id: "cpayment0000000000000001", amount: "9500", manualAdjustment: "-500" }),
      paidPayment({ id: "cpayment0000000000000002", amount: "10200", manualAdjustment: "200" }),
    ])

    await createCashClosing({ gymId: IDS.gym1, excludedPaymentIds: ["cpayment0000000000000002"] })

    expect(db.cashClosing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalCollected: 9500,
          paidCount: 1,
          adjustmentsCount: 1,
          adjustmentsTotal: -500,
        }),
      }),
    )
  })

  it("sin ajustes el cierre los muestra en cero", async () => {
    seed("payment", [paidPayment({ amount: "10000", manualAdjustment: null })])

    await createCashClosing({ gymId: IDS.gym1 })

    expect(db.cashClosing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ adjustmentsCount: 0, adjustmentsTotal: 0 }),
      }),
    )
  })
})
