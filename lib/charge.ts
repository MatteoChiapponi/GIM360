/**
 * Cómo se compone el total de un cobro, en un solo lugar.
 *
 * Las dos reglas del gimnasio no son intercambiables: la mora engorda la deuda
 * y el medio de pago ajusta sobre esa deuda ya engordada. Cobrar con tarjeta al
 * 10% una cuota de 10.000 con 1.000 de mora son 12.100, no 12.000 — y de ese
 * orden depende también el `methodAdjustment` que queda guardado.
 *
 * Vive en `lib/` y sin dependencias del server porque lo usan las dos puntas: la
 * vista previa del modal de cobro y el backend que después cobra de verdad. Que
 * sea la misma función es lo que garantiza que el número que ve quien cobra sea
 * el que se termina guardando; con la cuenta escrita dos veces, alcanzaba con
 * que alguien tocara una sola para que dejaran de coincidir en silencio.
 */

import { adjustedAmount, methodAdjustment, type PaymentMethodConfig } from "./payment-methods"
import { round2 } from "./money"

type MethodAdjustmentConfig = Pick<PaymentMethodConfig, "adjustmentType" | "adjustmentPercent">

/**
 * El total que dan las reglas del gimnasio, antes de que quien cobra lo toque a
 * mano. `methodAdjustment` va firmado (+ recargo / − descuento) y se calcula
 * sobre cuota + mora, no sobre la cuota sola.
 */
export function ruledCharge(
  cuota: number,
  lateFee: number,
  config: MethodAdjustmentConfig,
): { total: number; methodAdjustment: number } {
  const debt = round2(cuota + lateFee)
  return {
    total: adjustedAmount(debt, config),
    methodAdjustment: methodAdjustment(debt, config),
  }
}
