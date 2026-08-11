import { z } from "zod"

export const createReceptionistSchema = z.object({
  gymId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
})

export const updateReceptionistSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
})

export const resetReceptionistPasswordSchema = z.object({
  password: z.string().min(8),
})

export type CreateReceptionistInput = z.infer<typeof createReceptionistSchema>
export type UpdateReceptionistInput = z.infer<typeof updateReceptionistSchema>
export type ResetReceptionistPasswordInput = z.infer<typeof resetReceptionistPasswordSchema>
