import { z } from "zod"
import { DayOfWeek } from "@/app/generated/prisma/client"

export const createGroupSchema = z.object({
  gymId: z.string().min(1),
  name: z.string().min(1),
  monthlyPrice: z.number().positive(),
  maxCapacity: z.number().int().positive().optional(),
})

export const updateGroupSchema = createGroupSchema.omit({ gymId: true }).partial()

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

const trainerScheduleEntrySchema = z
  .object({
    weekDay: z.nativeEnum(DayOfWeek),
    startTime: z.string().regex(timeRegex, "Formato HH:MM"),
    endTime: z.string().regex(timeRegex, "Formato HH:MM"),
  })
  .refine((s) => s.startTime < s.endTime, {
    message: "startTime debe ser menor que endTime",
  })

export const assignTrainerSchema = z.object({
  trainerId: z.string().min(1),
  hourlyRate: z.number().positive(),
  schedules: z.array(trainerScheduleEntrySchema).min(1, "Al menos un horario es requerido"),
})

export const updateTrainerAssignmentSchema = z.object({
  hourlyRate: z.number().positive(),
  schedules: z.array(trainerScheduleEntrySchema).min(1, "Al menos un horario es requerido"),
})

export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>
export type AssignTrainerInput = z.infer<typeof assignTrainerSchema>
export type UpdateTrainerAssignmentInput = z.infer<typeof updateTrainerAssignmentSchema>
