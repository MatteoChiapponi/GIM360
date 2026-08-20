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
  "amount" | "baseAmount" | "paymentMethod" | "period" | "paidAt" | "lateFeeWaived" | "manualAdjustment"
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
  manualAdjustment?: number | null
  manualAdjustmentReason?: string | null
  paymentMethod?: PaymentMethod | null
}

export type PricingResult =
  | { ok: true; fields: PaymentAmountFields }
  /** El medio elegido está deshabilitado para ese gimnasio. */
  | { ok: false; error: "disabled-method"; method: PaymentMethod }
  /** Se quiso fijar el monto cobrado de una cuota que no se está cobrando. */
  | { ok: false; error: "not-charging" }

/** Un motivo vacío es lo mismo que no haber escrito ninguno. */
function normalizeReason(reason: string | null | undefined): string | null {
  const clean = reason?.trim()
  return clean ? clean : null
}

/**
 * El ajuste que pone quien cobra, medido contra `ruled` — lo que dieron las
 * reglas del gimnasio. Tres casos:
 *  - manda el monto cobrado → el ajuste es la diferencia,
 *  - manda `null` → lo borra, y
 *  - no lo manda → queda el que el pago ya traía (corregirle el medio a un pago
 *    cobrado no borra el redondeo que se le hizo al alumno).
 */
function manualAdjustmentFor(
  chargedAmount: number | null | undefined,
  stored: StoredPayment["manualAdjustment"],
  ruled: number,
): number {
  if (chargedAmount === undefined) return Number(stored ?? 0)
  return chargedAmount === null ? 0 : round2(chargedAmount - ruled)
}

/**
 * El motivo sigue al ajuste: si no quedó ajuste no hay nada que explicar, y un
 * cobro que fija el monto a mano trae el suyo — el de un ajuste anterior no
 * describe esta decisión. `undefined` es "no lo toques": si la edición no mueve
 * el monto, el motivo guardado sigue siendo el bueno.
 */
function reasonFor(manualAdjustment: number, input: UpdatePaymentInput): string | null | undefined {
  if (manualAdjustment === 0) return null
  if (input.chargedAmount === undefined) return undefined
  return normalizeReason(input.manualAdjustmentReason)
}

/**
 * Decide qué montos hay que guardar al actualizar un pago.
 *
 * Se aplican dos reglas del gimnasio y, arriba de todo, la decisión de quien
 * cobra, en este orden:
 *  1. el recargo por mora, que engorda la deuda según los días de atraso,
 *  2. el recargo o descuento del medio de pago, que se calcula sobre la deuda
 *     ya con la mora incluida — el medio ajusta lo que se termina cobrando, y
 *  3. el ajuste manual: si quien cobra dice cuánto se cobró de verdad
 *     (`chargedAmount`), ese es el monto, y la diferencia contra lo que daban
 *     las reglas queda registrada como `manualAdjustment`.
 *
 * De ahí la descomposición que queda guardada:
 *   `amount` = `baseAmount` + `lateFee` + `methodAdjustment` + `manualAdjustment`
 * con `baseAmount` = la cuota limpia, `lateFee` = la mora congelada al cobrar y
 * los dos ajustes firmados (+ se cobró de más / − se cobró de menos).
 */
export async function resolvePaymentAmounts(
  gymId: string,
  existing: StoredPayment,
  input: UpdatePaymentInput,
): Promise<PricingResult> {
  const cuota = existing.baseAmount !== null ? Number(existing.baseAmount) : undefined

  // Despagar, o sacarle el medio de pago: se van la mora y los ajustes con él, y
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
        // La condonación y el ajuste eran de ese cobro: al despagar se van con él.
        lateFeeWaived: false,
        manualAdjustment: null,
        manualAdjustmentReason: null,
      },
    }
  }

  const method = input.paymentMethod ?? existing.paymentMethod

  // Sin medio de pago no hay cobro, y sin cobro no hay monto que ajustar: dejarlo
  // pasar en silencio sería contestar 200 a algo que no se guardó.
  if (!method && input.chargedAmount != null) return { ok: false, error: "not-charging" }

  // Solo se recalcula si el cambio afecta al cobro: editar una nota no puede
  // mover el monto de un pago viejo porque la config del gimnasio cambió después.
  const repricing =
    input.paymentMethod !== undefined ||
    input.amount !== undefined ||
    input.lateFeeWaived !== undefined ||
    input.chargedAmount !== undefined ||
    input.status === "PAID"

  if (!method || !repricing) return { ok: true, fields: {} }

  const [config, lateConfig] = await Promise.all([
    getPaymentMethodConfig(gymId, method),
    getLateFeeConfig(gymId),
  ])
  if (!config.enabled) return { ok: false, error: "disabled-method", method }

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

  // Lo que dan las reglas del gimnasio, antes de que nadie lo toque a mano.
  const { amount: ruled, adjustment } = applyMethodAdjustment(round2(baseAmount + lateFee), config)

  const manual = manualAdjustmentFor(input.chargedAmount, existing.manualAdjustment, ruled)

  // Cobrado de verdad. El piso en 0 puede recortar el ajuste, así que el que se
  // guarda se deriva del monto final: la descomposición tiene que cerrar siempre.
  const amount = Math.max(round2(ruled + manual), 0)
  const manualAdjustment = round2(amount - ruled)

  return {
    ok: true,
    fields: {
      amount,
      baseAmount,
      lateFee,
      lateDays,
      lateFeeWaived: waived,
      methodAdjustment: adjustment,
      manualAdjustment,
      manualAdjustmentReason: reasonFor(manualAdjustment, input),
      paymentMethod: method,
    },
  }
}
