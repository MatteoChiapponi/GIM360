import { z } from "zod"

export const createCashClosingSchema = z.object({
  gymId: z.string().cuid(),
  notes: z.string().optional(),
})

export type CreateCashClosingInput = z.infer<typeof createCashClosingSchema>
