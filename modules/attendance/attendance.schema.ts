import { z } from "zod"

export const generateAttendanceSchema = z.object({
  gymId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
})

export const submitAttendanceSchema = z.object({
  students: z.array(
    z.object({
      studentId: z.string(),
      studentName: z.string(),
      present: z.boolean(),
    }),
  ),
})

export type GenerateAttendanceInput = z.infer<typeof generateAttendanceSchema>
export type SubmitAttendanceInput = z.infer<typeof submitAttendanceSchema>

export type AttendanceStudentEntry = {
  studentId: string
  studentName: string
  present: boolean
  markedByUserId: string
  markedByName: string
}

export type AttendanceDetail = {
  students: AttendanceStudentEntry[]
}
