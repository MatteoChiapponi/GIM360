import { z } from "zod"
import { StudentStatus } from "@/app/generated/prisma/client"

export const createStudentSchema = z.object({
  gymId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dueDay: z.number().int().min(1).max(31).optional(),
  birthDate: z.string().datetime().optional(),
  nationalId: z.string().optional(),
  phone: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyContact: z.string().optional(),
  status: z.nativeEnum(StudentStatus).optional(),
  trialEndsAt: z.string().datetime().optional(),
})

export const updateStudentSchema = createStudentSchema.omit({ gymId: true }).partial()

export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
