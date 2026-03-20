import { z } from "zod"
import { PaymentStatus, PaymentMethod } from "@/app/generated/prisma/client"

export const generatePaymentsSchema = z.object({
  gymId: z.string().cuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/, "period must be in YYYY-MM format"),
})

export const updatePaymentSchema = z.object({
  status: z.nativeEnum(PaymentStatus).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  paidAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  amount: z.number().positive().optional(),
})

export type GeneratePaymentsInput = z.infer<typeof generatePaymentsSchema>
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>
