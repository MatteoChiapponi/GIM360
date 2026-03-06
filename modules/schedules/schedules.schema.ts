import { z } from "zod"
import { DayOfWeek } from "@/app/generated/prisma/client"

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

export const createScheduleSchema = z.object({
  groupId: z.string().min(1),
  weekDays: z.array(z.nativeEnum(DayOfWeek)).min(1),
  startTime: z.string().regex(timeRegex, "Format HH:MM required"),
  endTime: z.string().regex(timeRegex, "Format HH:MM required"),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
})

export const updateScheduleSchema = createScheduleSchema.omit({ groupId: true }).partial()

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>
