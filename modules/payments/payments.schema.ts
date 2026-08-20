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
  amount: z.number().positive().multipleOf(0.01).optional(),
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
 * Lo que del body se puede guardar tal cual. `chargedAmount` queda afuera a
 * propósito: es la intención de quien cobra, no una columna — `resolvePaymentAmounts`
 * la traduce a `manualAdjustment` antes de que el update llegue a la DB.
 */
export const persistablePaymentSchema = updatePaymentSchema.omit({ chargedAmount: true })

export type GeneratePaymentsInput = z.infer<typeof generatePaymentsSchema>
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>
