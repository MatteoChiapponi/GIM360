import { z } from "zod"
import { MedicalClearance } from "@/app/generated/prisma/client"

export const createStudentSchema = z.object({
  gymId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  birthDate: z.string().datetime().optional(),
  nationalId: z.string().optional(),
  phone: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyContact: z.string().optional(),
  medicalClearance: z.nativeEnum(MedicalClearance).optional(),
  medicalClearanceExpiry: z.string().datetime().optional(),
})

export const updateStudentSchema = createStudentSchema.omit({ gymId: true }).partial()

export type CreateStudentInput = z.infer<typeof createStudentSchema>
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>
