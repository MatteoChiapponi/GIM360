import type { Payment, PaymentMethod } from "@/app/generated/prisma/client"
import {
  applyMethodAdjustment,
  getPaymentMethodConfig,
} from "@/modules/payment-methods/payment-methods.service"
import type { UpdatePaymentInput } from "./payments.schema"

/** Lo único que hace falta del pago guardado para poder recalcularlo. */
type StoredPayment = Pick<Payment, "amount" | "baseAmount" | "paymentMethod">

/** Campos de monto y medio de pago que el update tiene que persistir. */
export type PaymentAmountFields = {
  amount?: number
  baseAmount?: number | null
  methodAdjustment?: number | null
  paymentMethod?: PaymentMethod | null
}

export type PricingResult =
  | { ok: true; fields: PaymentAmountFields }
  | { ok: false; disabledMethod: PaymentMethod }

/**
 * Decide qué montos hay que guardar al actualizar un pago, aplicando el recargo
 * o descuento que el gimnasio le configuró al medio de pago.
 *
 * `amount` queda siempre con lo que se cobra de verdad, `baseAmount` con la
 * cuota antes del ajuste y `methodAdjustment` con el ajuste firmado.
 */
export async function resolvePaymentAmounts(
  gymId: string,
  existing: StoredPayment,
  input: UpdatePaymentInput,
): Promise<PricingResult> {
  const cuota = existing.baseAmount !== null ? Number(existing.baseAmount) : undefined

  // Despagar, o sacarle el medio de pago: el ajuste se va con él y vuelve la cuota
  if ((input.status && input.status !== "PAID") || input.paymentMethod === null) {
    return {
      ok: true,
      fields: {
        amount: input.amount ?? cuota,
        paymentMethod: null,
        baseAmount: null,
        methodAdjustment: null,
      },
    }
  }

  const method = input.paymentMethod ?? existing.paymentMethod

  // Solo se recalcula si el cambio afecta al cobro: editar una nota no puede
  // mover el monto de un pago viejo porque la config del gimnasio cambió después.
  const repricing =
    input.paymentMethod !== undefined || input.amount !== undefined || input.status === "PAID"

  if (!method || !repricing) return { ok: true, fields: {} }

  const config = await getPaymentMethodConfig(gymId, method)
  if (!config.enabled) return { ok: false, disabledMethod: method }

  // La cuota antes del ajuste: la que se manda, la que ya estaba guardada como
  // base, o el monto actual si el pago todavía no tenía ajuste.
  const baseAmount = input.amount ?? Number(existing.baseAmount ?? existing.amount)
  const { amount, adjustment } = applyMethodAdjustment(baseAmount, config)

  return { ok: true, fields: { amount, baseAmount, methodAdjustment: adjustment, paymentMethod: method } }
}
