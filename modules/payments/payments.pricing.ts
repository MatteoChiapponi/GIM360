import type { Payment, PaymentMethod, Student } from "@/app/generated/prisma/client"
import {
  applyMethodAdjustment,
  getPaymentMethodConfig,
} from "@/modules/payment-methods/payment-methods.service"
import { getLateFeeConfig, lateFeeFor } from "@/modules/late-fees/late-fees.service"
import { round2 } from "@/lib/money"
import type { UpdatePaymentInput } from "./payments.schema"

/** Lo único que hace falta del pago guardado para poder recalcularlo. */
type StoredPayment = Pick<
  Payment,
  "amount" | "baseAmount" | "paymentMethod" | "period" | "paidAt" | "lateFeeWaived"
> & {
  /** El alumno define el vencimiento de la cuota y si está exento de la mora. */
  student: Pick<Student, "dueDay" | "lateFeeExempt">
}

/** Campos de monto y medio de pago que el update tiene que persistir. */
export type PaymentAmountFields = {
  amount?: number
  baseAmount?: number | null
  methodAdjustment?: number | null
  lateFee?: number | null
  lateDays?: number | null
  lateFeeWaived?: boolean
  paymentMethod?: PaymentMethod | null
}

export type PricingResult =
  | { ok: true; fields: PaymentAmountFields }
  | { ok: false; disabledMethod: PaymentMethod }

/**
 * Decide qué montos hay que guardar al actualizar un pago.
 *
 * Se aplican dos reglas del gimnasio, en este orden:
 *  1. el recargo por mora, que engorda la deuda según los días de atraso, y
 *  2. el recargo o descuento del medio de pago, que se calcula sobre la deuda
 *     ya con la mora incluida — el medio ajusta lo que se termina cobrando.
 *
 * De ahí la descomposición que queda guardada:
 *   `amount` = `baseAmount` + `lateFee` + `methodAdjustment`
 * con `baseAmount` = la cuota limpia, `lateFee` = la mora congelada al cobrar y
 * `methodAdjustment` firmado (+ recargo / − descuento).
 */
export async function resolvePaymentAmounts(
  gymId: string,
  existing: StoredPayment,
  input: UpdatePaymentInput,
): Promise<PricingResult> {
  const cuota = existing.baseAmount !== null ? Number(existing.baseAmount) : undefined

  // Despagar, o sacarle el medio de pago: se van la mora y el ajuste con él, y
  // el pago vuelve a deber la cuota limpia.
  if ((input.status && input.status !== "PAID") || input.paymentMethod === null) {
    return {
      ok: true,
      fields: {
        amount: input.amount ?? cuota,
        paymentMethod: null,
        baseAmount: null,
        methodAdjustment: null,
        lateFee: null,
        lateDays: null,
        // La condonación era para ese cobro: al despagar vuelve a estar en juego.
        lateFeeWaived: false,
      },
    }
  }

  const method = input.paymentMethod ?? existing.paymentMethod

  // Solo se recalcula si el cambio afecta al cobro: editar una nota no puede
  // mover el monto de un pago viejo porque la config del gimnasio cambió después.
  const repricing =
    input.paymentMethod !== undefined ||
    input.amount !== undefined ||
    input.lateFeeWaived !== undefined ||
    input.status === "PAID"

  if (!method || !repricing) return { ok: true, fields: {} }

  const [config, lateConfig] = await Promise.all([
    getPaymentMethodConfig(gymId, method),
    getLateFeeConfig(gymId),
  ])
  if (!config.enabled) return { ok: false, disabledMethod: method }

  // La cuota limpia: la que se manda, la que ya estaba guardada como base, o el
  // monto actual si el pago todavía no tenía ajustes.
  const baseAmount = input.amount ?? Number(existing.baseAmount ?? existing.amount)

  // La mora se congela contra la fecha de cobro, no contra hoy: reeditar un pago
  // viejo (corregirle el medio, por ejemplo) no le suma atraso que nunca existió.
  const chargedAt = input.paidAt ? new Date(input.paidAt) : (existing.paidAt ?? new Date())
  const waived = input.lateFeeWaived ?? existing.lateFeeWaived
  const exempt = waived || existing.student.lateFeeExempt

  const { fee, lateDays } = lateFeeFor(baseAmount, existing.period, existing.student.dueDay, lateConfig, chargedAt)
  const lateFee = exempt ? 0 : fee

  const { amount, adjustment } = applyMethodAdjustment(round2(baseAmount + lateFee), config)

  return {
    ok: true,
    fields: {
      amount,
      baseAmount,
      lateFee,
      lateDays,
      lateFeeWaived: waived,
      methodAdjustment: adjustment,
      paymentMethod: method,
    },
  }
}
