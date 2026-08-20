import { describe, it, expect } from "vitest"
import { dueDateFor, isOverdue } from "@/modules/payments/payments.calc"

// De esta fecha dependen dos cosas: que la cuota pase a vencida y que se caigan
// los descuentos de "pago en término".

describe("dueDateFor", () => {
  it("vence el día de cobro del alumno, al final del día", () => {
    expect(dueDateFor("2026-03", 10)).toEqual(new Date(2026, 2, 10, 23, 59, 59))
  })

  it("si el mes es más corto que el día de cobro, vence el último día", () => {
    expect(dueDateFor("2026-02", 31)).toEqual(new Date(2026, 1, 28, 23, 59, 59))
  })

  it("respeta los años bisiestos", () => {
    expect(dueDateFor("2028-02", 31)).toEqual(new Date(2028, 1, 29, 23, 59, 59))
  })
})

describe("isOverdue", () => {
  it("el mismo día de vencimiento todavía no está vencida", () => {
    expect(isOverdue("2026-03", 10, new Date(2026, 2, 10, 22, 0, 0))).toBe(false)
  })

  it("al día siguiente sí", () => {
    expect(isOverdue("2026-03", 10, new Date(2026, 2, 11, 0, 1, 0))).toBe(true)
  })

  it("antes del vencimiento no", () => {
    expect(isOverdue("2026-03", 10, new Date(2026, 2, 1))).toBe(false)
  })
})
