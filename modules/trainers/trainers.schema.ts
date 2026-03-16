import { z } from "zod"

export const createTrainerSchema = z.object({
  gymId: z.string().min(1),
  name: z.string().min(1),
})

export const updateTrainerSchema = createTrainerSchema.omit({ gymId: true }).partial()

export type CreateTrainerInput = z.infer<typeof createTrainerSchema>
export type UpdateTrainerInput = z.infer<typeof updateTrainerSchema>
