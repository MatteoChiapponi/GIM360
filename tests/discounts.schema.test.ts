import { describe, it, expect } from "vitest"
import {
  assignDiscountSchema, createDiscountSchema, updateDiscountSchema,
} from "@/modules/discounts/discounts.schema"

// La validación es la primera puerta: lo que pase de acá se guarda tal cual.

const VALID = { gymId: "cgym10000000000000000001", name: "Hermanos", type: "PERCENTAGE", value: 20 }

/** El primer mensaje de error del campo, o null si el campo pasó. */
function errorOn(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }, field: string) {
  if (result.success) return null
  return result.error!.issues.some((issue) => issue.path[0] === field)
}

describe("createDiscountSchema", () => {
  it("acepta un descuento bien formado", () => {
    expect(createDiscountSchema.safeParse(VALID).success).toBe(true)
  })

  it("rechaza un porcentaje mayor a 100: dejaría la cuota en negativo", () => {
    const result = createDiscountSchema.safeParse({ ...VALID, value: 120 })
    expect(errorOn(result, "value")).toBe(true)
  })

  it("acepta el 100% — es el caso 'no paga'", () => {
    expect(createDiscountSchema.safeParse({ ...VALID, value: 100 }).success).toBe(true)
  })

  it("el tope de 100 es solo para porcentajes, no para montos", () => {
    expect(createDiscountSchema.safeParse({ ...VALID, type: "FIXED_AMOUNT", value: 15000 }).success).toBe(true)
    expect(createDiscountSchema.safeParse({ ...VALID, type: "FIXED_PRICE", value: 15000 }).success).toBe(true)
  })

  it("rechaza un valor de cero o negativo", () => {
    expect(createDiscountSchema.safeParse({ ...VALID, value: 0 }).success).toBe(false)
    expect(createDiscountSchema.safeParse({ ...VALID, value: -5 }).success).toBe(false)
  })

  it("rechaza más de dos decimales: no hay fracciones de centavo", () => {
    expect(createDiscountSchema.safeParse({ ...VALID, type: "FIXED_AMOUNT", value: 100.005 }).success).toBe(false)
  })

  it("rechaza un tipo que no existe", () => {
    expect(createDiscountSchema.safeParse({ ...VALID, type: "DOS_POR_UNO" }).success).toBe(false)
  })

  it("rechaza el nombre vacío", () => {
    expect(errorOn(createDiscountSchema.safeParse({ ...VALID, name: "" }), "name")).toBe(true)
  })

  it("rechaza días de gracia negativos o fraccionados", () => {
    expect(createDiscountSchema.safeParse({ ...VALID, graceDays: -1 }).success).toBe(false)
    expect(createDiscountSchema.safeParse({ ...VALID, graceDays: 2.5 }).success).toBe(false)
  })

  it("acepta días de gracia dentro del tope", () => {
    expect(createDiscountSchema.safeParse({ ...VALID, graceDays: 0 }).success).toBe(true)
    expect(createDiscountSchema.safeParse({ ...VALID, graceDays: 60 }).success).toBe(true)
    expect(createDiscountSchema.safeParse({ ...VALID, graceDays: 61 }).success).toBe(false)
  })
})

describe("updateDiscountSchema", () => {
  it("acepta un cambio parcial", () => {
    expect(updateDiscountSchema.safeParse({ active: false }).success).toBe(true)
  })

  it("sigue rechazando un porcentaje mayor a 100", () => {
    expect(updateDiscountSchema.safeParse({ type: "PERCENTAGE", value: 150 }).success).toBe(false)
  })

  it("no deja colar el gymId: un descuento no cambia de gimnasio", () => {
    const result = updateDiscountSchema.safeParse({ gymId: "otro-gym", name: "X" })
    expect(result.success && "gymId" in result.data).toBe(false)
  })
})

describe("assignDiscountSchema", () => {
  it("acepta una vigencia en formato YYYY-MM", () => {
    const result = assignDiscountSchema.safeParse({
      discountId: "cdiscount000000000000001",
      validFrom: "2026-03",
      validUntil: "2026-08",
    })
    expect(result.success).toBe(true)
  })

  it("acepta que no tenga fecha de corte", () => {
    const result = assignDiscountSchema.safeParse({
      discountId: "cdiscount000000000000001",
      validUntil: null,
    })
    expect(result.success).toBe(true)
  })

  it("rechaza una fecha completa: el período es mensual", () => {
    const result = assignDiscountSchema.safeParse({
      discountId: "cdiscount000000000000001",
      validFrom: "2026-03-15",
    })
    expect(errorOn(result, "validFrom")).toBe(true)
  })

  it("rechaza la asignación sin descuento", () => {
    expect(assignDiscountSchema.safeParse({ validFrom: "2026-03" }).success).toBe(false)
  })
})
