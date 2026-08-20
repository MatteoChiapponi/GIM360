import { describe, it, expect } from "vitest"
import { discountDeadlineFor, dueDateFor, isOverdue, pastDiscountDeadline } from "@/modules/payments/payments.calc"

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

describe("discountDeadlineFor", () => {
  it("sin días de gracia coincide con el vencimiento de la cuota", () => {
    expect(discountDeadlineFor("2026-03", 10, 0)).toEqual(dueDateFor("2026-03", 10))
  })

  it("corre el plazo tantos días como diga la gracia", () => {
    expect(discountDeadlineFor("2026-03", 10, 5)).toEqual(new Date(2026, 2, 15, 23, 59, 59))
  })

  it("si la gracia se pasa de mes, sigue en el mes siguiente", () => {
    expect(discountDeadlineFor("2026-03", 30, 5)).toEqual(new Date(2026, 3, 4, 23, 59, 59))
  })

  it("arranca desde el vencimiento ya recortado al último día del mes", () => {
    // Vence el 28 de febrero (no hay 31) y la gracia de 3 días cae en marzo.
    expect(discountDeadlineFor("2026-02", 31, 3)).toEqual(new Date(2026, 2, 3, 23, 59, 59))
  })
})

describe("pastDiscountDeadline", () => {
  it("la cuota puede estar vencida y el descuento seguir en pie", () => {
    const dentroDeLaGracia = new Date(2026, 2, 13)

    expect(isOverdue("2026-03", 10, dentroDeLaGracia)).toBe(true)
    expect(pastDiscountDeadline("2026-03", 10, 5, dentroDeLaGracia)).toBe(false)
  })

  it("pasada la gracia, el descuento se cae", () => {
    expect(pastDiscountDeadline("2026-03", 10, 5, new Date(2026, 2, 16))).toBe(true)
  })
})
