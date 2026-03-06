import { db } from "@/lib/db"
import type { CreateScheduleInput, UpdateScheduleInput } from "./schedules.schema"

export async function getSchedulesByGroup(groupId: string) {
  return db.schedule.findMany({ where: { groupId } })
}

export async function createSchedule(data: CreateScheduleInput) {
  return db.schedule.create({
    data: {
      ...data,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  })
}

export async function updateSchedule(id: string, data: UpdateScheduleInput) {
  return db.schedule.update({
    where: { id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  })
}

export async function deleteSchedule(id: string) {
  return db.schedule.delete({ where: { id } })
}
