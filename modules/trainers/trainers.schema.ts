import { z } from "zod"
import { ContractType } from "@/app/generated/prisma/client"

export const createTrainerSchema = z.object({
  gymId: z.string().min(1),
  name: z.string().min(1),
  contractType: z.nativeEnum(ContractType),
})

export const updateTrainerSchema = createTrainerSchema.omit({ gymId: true }).partial()

export type CreateTrainerInput = z.infer<typeof createTrainerSchema>
export type UpdateTrainerInput = z.infer<typeof updateTrainerSchema>
