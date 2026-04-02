import { z } from "zod"

export const createGymSchema = z.object({
  name: z.string().min(1),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
})

export const updateGymSchema = createGymSchema.partial()

export type CreateGymInput = z.infer<typeof createGymSchema>
export type UpdateGymInput = z.infer<typeof updateGymSchema>
