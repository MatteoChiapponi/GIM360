import { describe, it, expect, beforeEach, vi } from "vitest"

// Igual que en api-access: el fake de Prisma queda vivo, así que la config de
// medios de pago se lee de verdad y el cálculo del ajuste corre de punta a punta.
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
import { applyMethodAdjustment } from "@/modules/payment-methods/payment-methods.service"
import { IDS, SESSIONS, makeRequest, seedTwoGyms, withParams } from "./helpers"
import { seed } from "./mocks/db"

const mockAuth = vi.mocked(auth)
const mockUpdatePayment = vi.mocked(updatePayment)

beforeEach(() => {
  seedTwoGyms()
  mockAuth.mockResolvedValue(SESSIONS.owner1() as never)
})

/** Configura los medios de pago del gimnasio 1. Lo que no se pasa queda en default. */
function seedConfigs(rows: Record<string, unknown>[]) {
  seed("paymentMethodConfig", rows.map((r, i) => ({ id: `cfg${i}`, gymId: IDS.gym1, ...r })))
}

/** Marca el pago del fixture como cobrado con ese medio. */
async function markPaid(method: string) {
  const { PATCH } = await import("@/app/api/payments/[id]/route")
  return PATCH(
    makeRequest(`/api/payments/${IDS.payment1}?gymId=${IDS.gym1}`, {
      method: "PATCH",
      body: { status: "PAID", paidAt: new Date().toISOString(), paymentMethod: method },
    }),
    withParams({ id: IDS.payment1 }),
  )
}

describe("applyMethodAdjustment", () => {
  it("sin ajuste deja el monto como está", () => {
    expect(applyMethodAdjustment(10000, { adjustmentType: "NONE", adjustmentPercent: 0 }))
      .toEqual({ amount: 10000, adjustment: 0 })
  })

  it("el recargo suma y el descuento resta", () => {
    expect(applyMethodAdjustment(10000, { adjustmentType: "SURCHARGE", adjustmentPercent: 10 }))
      .toEqual({ amount: 11000, adjustment: 1000 })
    expect(applyMethodAdjustment(10000, { adjustmentType: "DISCOUNT", adjustmentPercent: 5 }))
      .toEqual({ amount: 9500, adjustment: -500 })
  })

  it("redondea a dos decimales", () => {
    expect(applyMethodAdjustment(9999.99, { adjustmentType: "SURCHARGE", adjustmentPercent: 7.5 }))
      .toEqual({ amount: 10749.99, adjustment: 750 })
  })

  it("un descuento del 100% no deja el monto en negativo", () => {
    expect(applyMethodAdjustment(10000, { adjustmentType: "DISCOUNT", adjustmentPercent: 100 }))
      .toEqual({ amount: 0, adjustment: -10000 })
  })
})

describe("Al cobrar una cuota se aplica la config del medio de pago", () => {
  it("un medio con recargo cobra de más y guarda el monto original", async () => {
    seedConfigs([{ method: "CARD", enabled: true, adjustmentType: "SURCHARGE", adjustmentPercent: 10 }])

    const res = await markPaid("CARD")

    expect(res.status).toBe(200)
    expect(mockUpdatePayment).toHaveBeenCalledWith(
      IDS.payment1,
      expect.objectContaining({ amount: 11000, baseAmount: 10000, methodAdjustment: 1000, paymentMethod: "CARD" }),
    )
  })

  it("un medio con descuento cobra de menos", async () => {
    seedConfigs([{ method: "CASH", enabled: true, adjustmentType: "DISCOUNT", adjustmentPercent: 5 }])

    await markPaid("CASH")

    expect(mockUpdatePayment).toHaveBeenCalledWith(
      IDS.payment1,
      expect.objectContaining({ amount: 9500, baseAmount: 10000, methodAdjustment: -500 }),
    )
  })

  it("un medio sin configurar cobra el monto de la cuota", async () => {
    await markPaid("TRANSFER")

    expect(mockUpdatePayment).toHaveBeenCalledWith(
      IDS.payment1,
      expect.objectContaining({ amount: 10000, baseAmount: 10000, methodAdjustment: 0 }),
    )
  })

  it("un medio deshabilitado no se puede usar para cobrar", async () => {
    seedConfigs([{ method: "CARD", enabled: false, adjustmentType: "NONE", adjustmentPercent: 0 }])

    const res = await markPaid("CARD")

    expect(res.status).toBe(400)
    expect(mockUpdatePayment).not.toHaveBeenCalled()
  })

  it("al despagar vuelve el monto de la cuota y se limpia el ajuste", async () => {
    seed("payment", [{
      id: IDS.payment1, gymId: IDS.gym1, studentId: IDS.student1, verified: false,
      status: "PAID", amount: "11000", baseAmount: "10000", methodAdjustment: "1000", paymentMethod: "CARD",
    }])

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
      expect.objectContaining({ amount: 10000, baseAmount: null, methodAdjustment: null, paymentMethod: null }),
    )
  })
})

describe("Configuración de medios de pago", () => {
  it("un gimnasio sin config responde los tres habilitados y sin ajuste", async () => {
    const { GET } = await import("@/app/api/payment-methods/route")
    const res = await GET(makeRequest(`/api/payment-methods?gymId=${IDS.gym1}`))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      { method: "CASH", enabled: true, adjustmentType: "NONE", adjustmentPercent: 0 },
      { method: "TRANSFER", enabled: true, adjustmentType: "NONE", adjustmentPercent: 0 },
      { method: "CARD", enabled: true, adjustmentType: "NONE", adjustmentPercent: 0 },
    ])
  })

  it("no se pueden deshabilitar los tres medios de pago", async () => {
    seedConfigs([
      { method: "CASH", enabled: false, adjustmentType: "NONE", adjustmentPercent: 0 },
      { method: "TRANSFER", enabled: false, adjustmentType: "NONE", adjustmentPercent: 0 },
    ])

    const { PATCH } = await import("@/app/api/payment-methods/route")
    const res = await PATCH(
      makeRequest("/api/payment-methods", {
        method: "PATCH",
        body: {
          gymId: IDS.gym1,
          configs: [{ method: "CARD", enabled: false, adjustmentType: "NONE", adjustmentPercent: 0 }],
        },
      }),
    )

    expect(res.status).toBe(400)
  })

  it("un recargo sin porcentaje no pasa la validación", async () => {
    const { PATCH } = await import("@/app/api/payment-methods/route")
    const res = await PATCH(
      makeRequest("/api/payment-methods", {
        method: "PATCH",
        body: {
          gymId: IDS.gym1,
          configs: [{ method: "CARD", enabled: true, adjustmentType: "SURCHARGE", adjustmentPercent: 0 }],
        },
      }),
    )

    expect(res.status).toBe(400)
  })
})
