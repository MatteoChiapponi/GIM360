import { DiscountType } from "@/app/generated/prisma/client"

/** Un descuento reducido a lo que hace falta para calcular. */
export type DiscountRule = {
  type: DiscountType
  value: number
  /** Si es true, se pierde cuando la cuota pasa su fecha de vencimiento. */
  loseOnLatePayment: boolean
}

/** Asignación de un descuento a un alumno, con su vigencia en períodos mensuales. */
export type DiscountAssignment = {
  validFrom: Date
  validUntil: Date | null
  discount: DiscountRule & { active: boolean }
}

/** Redondea a 2 decimales sin arrastrar el error del punto flotante. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Cuánto se descuenta sobre `baseAmount`.
 * Nunca devuelve más que la base ni un número negativo: la cuota no puede
 * quedar por debajo de cero ni convertirse en un crédito a favor del alumno.
 */
export function computeDiscountAmount(baseAmount: number, rule: Pick<DiscountRule, "type" | "value">): number {
  if (baseAmount <= 0) return 0

  const raw =
    rule.type === DiscountType.PERCENTAGE ? (baseAmount * rule.value) / 100
    : rule.type === DiscountType.FIXED_AMOUNT ? rule.value
    : baseAmount - rule.value // FIXED_PRICE: `value` es el precio final

  return round2(Math.min(Math.max(raw, 0), baseAmount))
}

/**
 * ¿Corresponde aplicar este descuento a una cuota que está vencida?
 *
 * Un descuento marcado como "solo por pago en término" no se aplica mientras la
 * cuota esté vencida. No es un castigo permanente: la cuota guarda el descuento
 * que le tocaba, así que si la fecha de vencimiento se corrige y deja de estar
 * vencida, vuelve a aplicarse.
 */
export function discountApplies(rule: Pick<DiscountRule, "loseOnLatePayment">, isLate: boolean): boolean {
  return !(rule.loseOnLatePayment && isLate)
}

/** Vigencias expresadas en períodos mensuales; `until` null = sin fecha de corte. */
export function coversPeriod(from: Date, until: Date | null, period: Date): boolean {
  if (period.getTime() < from.getTime()) return false
  return until === null || period.getTime() <= until.getTime()
}

/**
 * Descuento aplicable a un alumno en un período dado.
 *
 * El servicio impide vigencias solapadas para un mismo alumno, así que como
 * mucho hay una candidata. Ante un empate inesperado gana la de vigencia más
 * reciente, que es la última decisión que tomó el dueño.
 */
export function resolveApplicableDiscount<T extends DiscountAssignment>(
  assignments: T[],
  period: Date,
): T | null {
  const applicable = assignments
    .filter((a) => a.discount.active && coversPeriod(a.validFrom, a.validUntil, period))
    .sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime())

  return applicable[0] ?? null
}

/** ¿Se pisan dos vigencias? (`until` null = abierta hacia adelante) */
export function rangesOverlap(
  aFrom: Date, aUntil: Date | null,
  bFrom: Date, bUntil: Date | null,
): boolean {
  const aEnd = aUntil?.getTime() ?? Infinity
  const bEnd = bUntil?.getTime() ?? Infinity
  return aFrom.getTime() <= bEnd && bFrom.getTime() <= aEnd
}
