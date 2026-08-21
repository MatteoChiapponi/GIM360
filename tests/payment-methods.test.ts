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
import { ruledCharge } from "@/lib/charge"
import { createGym } from "@/modules/gyms/gyms.service"
import { IDS, SESSIONS, makeRequest, paymentRow, seedTwoGyms, withParams } from "./helpers"
import { db, seed } from "./mocks/db"

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

describe("ruledCharge — el total que dan las reglas del gimnasio", () => {
  it("sin ajuste ni mora deja el monto como está", () => {
    expect(ruledCharge(10000, 0, { adjustmentType: "NONE", adjustmentPercent: 0 }))
      .toEqual({ total: 10000, methodAdjustment: 0 })
  })

  it("el recargo suma y el descuento resta", () => {
    expect(ruledCharge(10000, 0, { adjustmentType: "SURCHARGE", adjustmentPercent: 10 }))
      .toEqual({ total: 11000, methodAdjustment: 1000 })
    expect(ruledCharge(10000, 0, { adjustmentType: "DISCOUNT", adjustmentPercent: 5 }))
      .toEqual({ total: 9500, methodAdjustment: -500 })
  })

  it("el medio ajusta sobre la cuota con la mora ya sumada, no sobre la cuota sola", () => {
    // 10000 + 1000 de mora = 11000, y el 10% se calcula sobre esos 11000
    expect(ruledCharge(10000, 1000, { adjustmentType: "SURCHARGE", adjustmentPercent: 10 }))
      .toEqual({ total: 12100, methodAdjustment: 1100 })
  })

  it("redondea a dos decimales", () => {
    expect(ruledCharge(9999.99, 0, { adjustmentType: "SURCHARGE", adjustmentPercent: 7.5 }))
      .toEqual({ total: 10749.99, methodAdjustment: 750 })
  })

  it("un descuento del 100% no deja el monto en negativo", () => {
    expect(ruledCharge(10000, 0, { adjustmentType: "DISCOUNT", adjustmentPercent: 100 }))
      .toEqual({ total: 0, methodAdjustment: -10000 })
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

  it("editar una nota no recalcula el monto con la config de hoy", async () => {
    // El pago se cobró con tarjeta al 10%; después el gimnasio la subió al 25%.
    seed("payment", [paymentRow({
      status: "PAID", amount: "11000", baseAmount: "10000", methodAdjustment: "1000", paymentMethod: "CARD",
      paidAt: new Date(Date.UTC(2026, 7, 5)),
    })])
    seedConfigs([{ method: "CARD", enabled: true, adjustmentType: "SURCHARGE", adjustmentPercent: 25 }])

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

  it("corregir el monto de un pago cobrado reaplica el ajuste sobre la cuota nueva", async () => {
    seed("payment", [paymentRow({
      status: "PAID", amount: "11000", baseAmount: "10000", methodAdjustment: "1000", paymentMethod: "CARD",
      paidAt: new Date(Date.UTC(2026, 7, 5)),
    })])
    seedConfigs([{ method: "CARD", enabled: true, adjustmentType: "SURCHARGE", adjustmentPercent: 10 }])

    const { PATCH } = await import("@/app/api/payments/[id]/route")
    await PATCH(
      makeRequest(`/api/payments/${IDS.payment1}?gymId=${IDS.gym1}`, {
        method: "PATCH",
        body: { amount: 20000 },
      }),
      withParams({ id: IDS.payment1 }),
    )

    expect(mockUpdatePayment).toHaveBeenCalledWith(
      IDS.payment1,
      expect.objectContaining({ amount: 22000, baseAmount: 20000, methodAdjustment: 2000, paymentMethod: "CARD" }),
    )
  })

  it("al despagar vuelve el monto de la cuota y se limpia el ajuste", async () => {
    seed("payment", [paymentRow({
      status: "PAID", amount: "11000", baseAmount: "10000", methodAdjustment: "1000", paymentMethod: "CARD",
      paidAt: new Date(Date.UTC(2026, 7, 5)),
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

describe("Un gimnasio nuevo nace con los tres medios de pago", () => {
  it("los crea junto con el gimnasio, habilitados y sin ajuste", async () => {
    seed("owner", [{ id: "cowner00000000000000001", userId: IDS.ownerUser1 }])
    db.gym.create.mockResolvedValue({ id: "cgym30000000000000000003" })

    await createGym(IDS.ownerUser1, { name: "Gimnasio Nuevo" })

    const { data } = db.gym.create.mock.calls[0][0] as {
      data: { paymentMethodConfigs: { create: Record<string, unknown>[] } }
    }
    expect(data.paymentMethodConfigs.create).toEqual([
      { method: "CASH", enabled: true, adjustmentType: "NONE", adjustmentPercent: 0 },
      { method: "TRANSFER", enabled: true, adjustmentType: "NONE", adjustmentPercent: 0 },
      { method: "CARD", enabled: true, adjustmentType: "NONE", adjustmentPercent: 0 },
    ])
  })
})
