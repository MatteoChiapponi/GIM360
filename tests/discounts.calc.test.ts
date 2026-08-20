import { describe, it, expect } from "vitest"
import {
  computeDiscountAmount,
  coversPeriod,
  discountApplies,
  rangesOverlap,
  resolveApplicableDiscount,
  type DiscountAssignment,
} from "@/modules/discounts/discounts.calc"
import { parsePeriod } from "@/lib/period"

// Acá vive la plata: lo que estos casos fijan es cuánto termina pagando el
// alumno. El resto del feature (rutas, UI) solo mueve estos números de lugar.

describe("computeDiscountAmount", () => {
  it("descuenta el porcentaje sobre la base", () => {
    expect(computeDiscountAmount(30000, { type: "PERCENTAGE", value: 20 })).toBe(6000)
  })

  it("descuenta el monto fijo tal cual", () => {
    expect(computeDiscountAmount(30000, { type: "FIXED_AMOUNT", value: 5000 })).toBe(5000)
  })

  it("con precio fijo, descuenta la diferencia hasta ese precio", () => {
    expect(computeDiscountAmount(30000, { type: "FIXED_PRICE", value: 18000 })).toBe(12000)
  })

  it("nunca descuenta más que la base: la cuota no puede quedar negativa", () => {
    expect(computeDiscountAmount(10000, { type: "FIXED_AMOUNT", value: 25000 })).toBe(10000)
    expect(computeDiscountAmount(10000, { type: "PERCENTAGE", value: 100 })).toBe(10000)
  })

  it("un precio fijo mayor a la cuota no genera un recargo", () => {
    expect(computeDiscountAmount(10000, { type: "FIXED_PRICE", value: 25000 })).toBe(0)
  })

  it("sobre una base de cero no descuenta nada", () => {
    expect(computeDiscountAmount(0, { type: "PERCENTAGE", value: 50 })).toBe(0)
  })

  it("redondea a dos decimales", () => {
    expect(computeDiscountAmount(33333.33, { type: "PERCENTAGE", value: 15 })).toBe(5000)
  })
})

describe("coversPeriod", () => {
  const from = parsePeriod("2026-03")
  const until = parsePeriod("2026-05")

  it("incluye los dos extremos de la vigencia", () => {
    expect(coversPeriod(from, until, parsePeriod("2026-03"))).toBe(true)
    expect(coversPeriod(from, until, parsePeriod("2026-05"))).toBe(true)
  })

  it("deja afuera los meses previos y posteriores", () => {
    expect(coversPeriod(from, until, parsePeriod("2026-02"))).toBe(false)
    expect(coversPeriod(from, until, parsePeriod("2026-06"))).toBe(false)
  })

  it("sin fecha de corte sigue vigente hacia adelante", () => {
    expect(coversPeriod(from, null, parsePeriod("2030-12"))).toBe(true)
    expect(coversPeriod(from, null, parsePeriod("2026-02"))).toBe(false)
  })
})

describe("rangesOverlap", () => {
  it("detecta el solapamiento aunque sea de un solo mes", () => {
    expect(rangesOverlap(
      parsePeriod("2026-01"), parsePeriod("2026-03"),
      parsePeriod("2026-03"), parsePeriod("2026-06"),
    )).toBe(true)
  })

  it("acepta rangos consecutivos que no se tocan", () => {
    expect(rangesOverlap(
      parsePeriod("2026-01"), parsePeriod("2026-02"),
      parsePeriod("2026-03"), null,
    )).toBe(false)
  })

  it("un rango abierto se pisa con cualquier cosa posterior", () => {
    expect(rangesOverlap(
      parsePeriod("2026-01"), null,
      parsePeriod("2030-01"), null,
    )).toBe(true)
  })
})

function assignment(from: string, until: string | null, active = true): DiscountAssignment {
  return {
    validFrom: parsePeriod(from),
    validUntil: until ? parsePeriod(until) : null,
    discount: { type: "PERCENTAGE", value: 10, active, loseOnLatePayment: false },
  }
}

describe("resolveApplicableDiscount", () => {
  it("elige la asignación que cubre el período", () => {
    const vieja = assignment("2025-01", "2025-12")
    const actual = assignment("2026-01", null)
    expect(resolveApplicableDiscount([vieja, actual], parsePeriod("2026-04"))).toBe(actual)
  })

  it("ignora las asignaciones de un descuento desactivado", () => {
    const desactivado = assignment("2026-01", null, false)
    expect(resolveApplicableDiscount([desactivado], parsePeriod("2026-04"))).toBeNull()
  })

  it("devuelve null cuando ninguna vigencia alcanza al período", () => {
    expect(resolveApplicableDiscount([assignment("2026-06", null)], parsePeriod("2026-04"))).toBeNull()
  })

  it("sin asignaciones no hay descuento", () => {
    expect(resolveApplicableDiscount([], parsePeriod("2026-04"))).toBeNull()
  })
})

describe("discountApplies", () => {
  it("un descuento común se aplica igual sobre una cuota vencida", () => {
    expect(discountApplies({ loseOnLatePayment: false }, true)).toBe(true)
  })

  it("uno de pago en término no se aplica si la cuota está vencida", () => {
    expect(discountApplies({ loseOnLatePayment: true }, true)).toBe(false)
  })

  it("uno de pago en término se aplica mientras la cuota no venza", () => {
    expect(discountApplies({ loseOnLatePayment: true }, false)).toBe(true)
  })
})
