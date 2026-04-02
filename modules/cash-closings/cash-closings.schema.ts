import { z } from "zod"

export const createCashClosingSchema = z.object({
  gymId: z.string().cuid(),
  notes: z.string().nullable().optional(),
  excludedPaymentIds: z.array(z.string().cuid()).optional(),
})

export type CreateCashClosingInput = z.infer<typeof createCashClosingSchema>
