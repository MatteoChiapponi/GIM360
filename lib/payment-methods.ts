/**
 * Espejo liviano de la config de medios de pago para el lado del cliente.
 *
 * No importa el cliente de Prisma a propósito: estos tipos y helpers los usan
 * componentes "use client". El cálculo del monto real lo hace siempre el
 * backend (`applyMethodAdjustment` en modules/payment-methods) — acá solo se
 * previsualiza lo mismo con la misma fórmula.
 */

export const PAYMENT_METHOD_VALUES = ["CASH", "TRANSFER", "CARD"] as const

export type PaymentMethodValue = (typeof PAYMENT_METHOD_VALUES)[number]
export type AdjustmentType = "NONE" | "SURCHARGE" | "DISCOUNT"

export type PaymentMethodConfig = {
  method: PaymentMethodValue
  enabled: boolean
  adjustmentType: AdjustmentType
  adjustmentPercent: number
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodValue, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Ajuste firmado (+ recargo / − descuento) que el medio de pago aplica al monto. */
export function methodAdjustment(
  baseAmount: number,
  config: Pick<PaymentMethodConfig, "adjustmentType" | "adjustmentPercent">,
): number {
  if (config.adjustmentType === "NONE" || !config.adjustmentPercent) return 0
  const delta = round2((baseAmount * config.adjustmentPercent) / 100)
  return config.adjustmentType === "DISCOUNT" ? -delta : delta
}

/** Monto final a cobrar con ese medio de pago. */
export function adjustedAmount(
  baseAmount: number,
  config: Pick<PaymentMethodConfig, "adjustmentType" | "adjustmentPercent">,
): number {
  return Math.max(round2(baseAmount + methodAdjustment(baseAmount, config)), 0)
}

/** "+10%" / "−5%" / null si no tiene ajuste. */
export function adjustmentLabel(
  config: Pick<PaymentMethodConfig, "adjustmentType" | "adjustmentPercent">,
): string | null {
  if (config.adjustmentType === "NONE" || !config.adjustmentPercent) return null
  const sign = config.adjustmentType === "DISCOUNT" ? "−" : "+"
  return `${sign}${config.adjustmentPercent}%`
}

/** Config por defecto de un medio que el gimnasio todavía no tocó. */
export function defaultPaymentMethodConfig(method: PaymentMethodValue): PaymentMethodConfig {
  return { method, enabled: true, adjustmentType: "NONE", adjustmentPercent: 0 }
}

export const formatMoney = (n: number) => `$${n.toLocaleString("es-AR")}`
