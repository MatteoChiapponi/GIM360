import { z } from "zod"

export const createTrainerSchema = z.object({
  gymId: z.string().min(1),
  name: z.string().min(1),
  startedAt: z.string().datetime().nullable().optional(),
})

export const updateTrainerSchema = createTrainerSchema.omit({ gymId: true }).partial()

export type CreateTrainerInput = z.infer<typeof createTrainerSchema>
export type UpdateTrainerInput = z.infer<typeof updateTrainerSchema>

export const assignTrainerUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
export type AssignTrainerUserInput = z.infer<typeof assignTrainerUserSchema>
