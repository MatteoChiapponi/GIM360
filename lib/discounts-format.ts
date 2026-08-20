/**
 * Etiquetas y formato de descuentos, compartidos por las vistas de Descuentos,
 * Alumnos y Cuotas. El tipo se declara acá como unión de strings (y no se
 * importa de Prisma) para no arrastrar el cliente generado a un componente
 * cliente, igual que hacen las demás vistas con sus enums.
 */
export type DiscountType = "PERCENTAGE" | "FIXED_AMOUNT" | "FIXED_PRICE"

export const DISCOUNT_TYPE_LABEL: Record<DiscountType, string> = {
  PERCENTAGE: "Porcentaje",
  FIXED_AMOUNT: "Monto fijo",
  FIXED_PRICE: "Precio fijo",
}

export const DISCOUNT_TYPE_HINT: Record<DiscountType, string> = {
  PERCENTAGE: "Se descuenta ese porcentaje de la cuota. Ej: 20% sobre $30.000 → paga $24.000.",
  FIXED_AMOUNT: "Se resta ese monto de la cuota. Ej: $5.000 sobre $30.000 → paga $25.000.",
  FIXED_PRICE: "La cuota pasa a valer ese monto, sin importar en cuántos grupos esté el alumno. Ideal para becas o precios especiales.",
}

export function formatMoney(value: string | number): string {
  return `$${Number(value).toLocaleString("es-AR")}`
}

/** Cómo se lee el valor de un descuento según su tipo. */
export function formatDiscountValue(type: DiscountType, value: string | number): string {
  if (type === "PERCENTAGE") return `${Number(value)}%`
  if (type === "FIXED_AMOUNT") return `−${formatMoney(value)}`
  return `${formatMoney(value)} fijo`
}

/**
 * Cuánto se descuenta sobre `base`. Es el mismo cálculo que hace el backend al
 * generar la cuota; acá solo sirve para previsualizar antes de asignar.
 */
export function previewDiscountAmount(base: number, type: DiscountType, value: number): number {
  if (base <= 0) return 0
  const raw =
    type === "PERCENTAGE" ? (base * value) / 100
    : type === "FIXED_AMOUNT" ? value
    : base - value
  return Math.round(Math.min(Math.max(raw, 0), base) * 100) / 100
}
