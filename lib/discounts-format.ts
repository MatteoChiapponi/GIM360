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

/** Leyenda del descuento que se pierde por mora, usada en las tres vistas. */
export const ON_TIME_ONLY_LABEL = "Solo por pago en término"
export const ON_TIME_ONLY_HINT =
  "El descuento se pierde si el alumno paga pasado el plazo. El plazo es el vencimiento de la cuota más los días de gracia que definas."

/** Cómo se lee el plazo de un descuento que se pierde por mora. */
export function formatGracePeriod(graceDays: number): string {
  if (graceDays === 0) return "Se pierde el mismo día que vence la cuota"
  if (graceDays === 1) return "Se pierde 1 día después del vencimiento"
  return `Se pierde ${graceDays} días después del vencimiento`
}
