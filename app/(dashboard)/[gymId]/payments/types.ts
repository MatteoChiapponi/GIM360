/**
 * Tipos que comparten la vista de cuotas y el modal de cobro.
 *
 * Son la forma en que la API devuelve un pago: los montos vienen como string
 * porque del lado del server son `Decimal`.
 */

import type { PaymentMethodValue } from "@/lib/payment-methods"

export type PaymentStatus = "PENDING" | "PAID" | "EXPIRED"

export type Payment = {
  id: string
  amount: string
  status: PaymentStatus
  paidAt: string | null
  paymentMethod: PaymentMethodValue | null
  /** Monto de la cuota antes de los ajustes (null si todavía no se cobró) */
  baseAmount: string | null
  /** Ajuste aplicado por el medio de pago, firmado (+ recargo / − descuento) */
  methodAdjustment: string | null
  /** Recargo por mora congelado al cobrar (null mientras la cuota siga impaga) */
  lateFee: string | null
  lateDays: number | null
  /** El recargo se condonó a mano para esta cuota */
  lateFeeWaived: boolean
  /** Diferencia que puso a mano quien cobró, firmada (+ de más / − de menos) */
  manualAdjustment: string | null
  manualAdjustmentReason: string | null
  verified: boolean
  cashClosingId: string | null
  student: { id: string; firstName: string; lastName: string; dueDay: number; phone1: string; lateFeeExempt: boolean }
}
