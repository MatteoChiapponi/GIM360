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
  /** Decisión manual sobre el descuento: true = aplicar, false = no aplicar,
   *  null = volver al automático. El monto lo recalcula el servidor.
   *
   *  `amount` no se acepta a propósito: desde que hay descuentos es un valor
   *  derivado (`baseAmount - discountAmount`), y dejar que el cliente lo fije
   *  rompía esa relación en silencio hasta la próxima sincronización. */
  discountOverride: z.boolean().nullable().optional(),
})

export type GeneratePaymentsInput = z.infer<typeof generatePaymentsSchema>
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>
