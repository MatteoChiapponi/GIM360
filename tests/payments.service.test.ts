import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/lib/db", () => import("./mocks/db"))

import { db, seed } from "./mocks/db"
import { setDiscountOverride } from "@/modules/payments/payments.service"
import { IDS } from "./helpers"

// La decisión manual del operario sobre el descuento de una cuota puntual.
// El monto siempre lo recalcula el servidor: nunca llega desde el cliente.

const PAYMENT_ID = "cpayment0000000000000001"

// Períodos lejanos en cada dirección, para que "está vencida" no dependa del día
// en que corran los tests.
const LONG_OVERDUE = new Date(Date.UTC(2020, 0, 1))
const FAR_FUTURE = new Date(Date.UTC(2099, 0, 1))

type PaymentOverrides = Record<string, unknown>

function seedPayment(overrides: PaymentOverrides = {}) {
  seed("payment", [{
    id: PAYMENT_ID,
    gymId: IDS.gym1,
    studentId: IDS.student1,
    period: LONG_OVERDUE,
    baseAmount: 30000,
    amount: 30000,
    discountAmount: 0,
    discountId: IDS.discount1,
    discountName: "Pronto pago",
    discountOverride: null,
    status: "EXPIRED",
    student: { dueDay: 10 },
    discount: { type: "PERCENTAGE", value: 10, loseOnLatePayment: true },
    ...overrides,
  }])
}

/** Los montos con los que quedó la cuota después del override. */
function updatedData() {
  const [args] = db.payment.update.mock.calls.at(-1) as [{ data: Record<string, unknown> }]
  return args.data
}

beforeEach(() => seedPayment())

describe("setDiscountOverride", () => {
  it("aplica el descuento aunque la cuota esté vencida, si el operario lo decide", async () => {
    await setDiscountOverride(PAYMENT_ID, true)

    expect(updatedData()).toEqual({
      discountOverride: true,
      discountAmount: 3000,
      amount: 27000,
    })
  })

  it("saca el descuento de una cuota que sí lo tenía aplicado", async () => {
    seedPayment({
      period: FAR_FUTURE,
      status: "PENDING",
      amount: 27000,
      discountAmount: 3000,
    })

    await setDiscountOverride(PAYMENT_ID, false)

    expect(updatedData()).toEqual({
      discountOverride: false,
      discountAmount: 0,
      amount: 30000,
    })
  })

  it("volver al automático devuelve la decisión a la regla", async () => {
    // Cuota vencida con un descuento de pago en término: sin decisión manual,
    // la regla lo saca.
    await setDiscountOverride(PAYMENT_ID, null)

    expect(updatedData()).toEqual({
      discountOverride: null,
      discountAmount: 0,
      amount: 30000,
    })
  })

  it("volver al automático reaplica el descuento si la cuota no está vencida", async () => {
    seedPayment({ period: FAR_FUTURE, status: "PENDING" })

    await setDiscountOverride(PAYMENT_ID, null)

    expect(updatedData()).toEqual({
      discountOverride: null,
      discountAmount: 3000,
      amount: 27000,
    })
  })

  it("no toca una cuota ya cobrada", async () => {
    seedPayment({ status: "PAID" })

    await expect(setDiscountOverride(PAYMENT_ID, true)).rejects.toThrow("PAYMENT_ALREADY_PAID")
    expect(db.payment.update).not.toHaveBeenCalled()
  })

  it("rechaza la cuota que no tiene ningún descuento para aplicar", async () => {
    seedPayment({ discount: null, discountId: null, discountName: null })

    await expect(setDiscountOverride(PAYMENT_ID, true)).rejects.toThrow("PAYMENT_WITHOUT_DISCOUNT")
    expect(db.payment.update).not.toHaveBeenCalled()
  })

  it("rechaza una cuota inexistente", async () => {
    await expect(setDiscountOverride("cuota-fantasma", true)).rejects.toThrow("PAYMENT_NOT_FOUND")
  })
})
