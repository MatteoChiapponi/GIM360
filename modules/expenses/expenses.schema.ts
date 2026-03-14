import { z } from "zod"

export const createExpenseSchema = z.object({
  gymId: z.string().min(1),
  name: z.string().min(1),
  amount: z.number().positive(),
})

export const updateExpenseSchema = createExpenseSchema.omit({ gymId: true }).partial()

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>
