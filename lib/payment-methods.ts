/**
 * Medios de pago: la parte que comparten el backend y las vistas.
 *
 * Vive en `lib/` y no importa el cliente de Prisma a propósito, porque de acá
 * lee cualquier componente "use client" (las vistas nunca importan de
 * `modules/`, que es server-side). La fórmula del ajuste está una sola vez:
 * `applyMethodAdjustment` del servicio delega en estas funciones, así que el
 * monto que previsualiza la pantalla es el mismo que después cobra el backend.
 *
 * Los valores duplican el enum `PaymentMethod` de Prisma; el servicio tiene un
 * chequeo de tipos que deja de compilar si alguno de los dos se mueve.
 */

import { round2 } from "./money"

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
