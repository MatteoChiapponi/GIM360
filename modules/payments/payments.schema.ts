import { z } from "zod"
import { PaymentStatus, PaymentMethod } from "@/app/generated/prisma/client"

export const generatePaymentsSchema = z.object({
  gymId: z.string().cuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/, "period must be in YYYY-MM format"),
})

export const updatePaymentSchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).nullable().optional(),
  paidAt: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  /**
   * La cuota limpia con la que se cobra. Mientras está impaga la define el
   * precio de lista menos el descuento, así que mandarla a mano acá dura hasta
   * la próxima sincronización; al cobrar es el punto de partida de los ajustes.
   */
  amount: z.number().positive().multipleOf(0.01).optional(),
  /**
   * Decisión manual sobre el descuento de esta cuota: true = aplicarlo igual,
   * false = no aplicarlo, null = volver al automático. Va sola: el handler la
   * atiende aparte y recalcula el monto en el servidor.
   */
  discountOverride: z.boolean().nullable().optional(),
  /** Condona el recargo por mora de esta cuota puntual, sin tocar la regla del gimnasio. */
  lateFeeWaived: z.boolean().optional(),
  /**
   * Monto que realmente se cobró, cuando quien cobra lo ajusta a mano: un
   * redondeo, unos pesos de menos, una diferencia acordada. La diferencia
   * contra lo que daban las reglas del gimnasio queda guardada en
   * `manualAdjustment`. `null` borra el ajuste y vuelve al monto calculado.
   */
  chargedAmount: z.number().nonnegative().multipleOf(0.01).nullable().optional(),
  /** Motivo del ajuste manual, opcional y libre. */
  manualAdjustmentReason: z.string().max(200).nullable().optional(),
})

/**
 * Lo que del body se puede guardar tal cual. Quedan afuera a propósito los dos
 * campos que son una intención y no una columna: `chargedAmount`, que
 * `resolvePaymentAmounts` traduce a `manualAdjustment`, y `discountOverride`,
 * que el handler atiende por su cuenta recalculando el monto.
 */
export const persistablePaymentSchema = updatePaymentSchema.omit({
  chargedAmount: true,
  discountOverride: true,
})

export type GeneratePaymentsInput = z.infer<typeof generatePaymentsSchema>
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>
