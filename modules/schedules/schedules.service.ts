import { db } from "@/lib/db"
import type { CreateScheduleInput, UpdateScheduleInput } from "./schedules.schema"

export async function getSchedulesByGroup(groupId: string) {
  return db.schedule.findMany({ where: { groupId } })
}

export async function createSchedule(data: CreateScheduleInput) {
  return db.schedule.create({
    data: {
      ...data,
      fechaInicio: new Date(data.fechaInicio),
      fechaFin: data.fechaFin ? new Date(data.fechaFin) : undefined,
    },
  })
}

export async function updateSchedule(id: string, data: UpdateScheduleInput) {
  return db.schedule.update({
    where: { id },
    data: {
      ...data,
      fechaInicio: data.fechaInicio ? new Date(data.fechaInicio) : undefined,
      fechaFin: data.fechaFin ? new Date(data.fechaFin) : undefined,
    },
  })
}

export async function deleteSchedule(id: string) {
  return db.schedule.delete({ where: { id } })
}
