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
      endDate: data.endDate ? new Date(data.endDate) : null,
    },
  })
}

export async function updateSchedule(id: string, data: UpdateScheduleInput) {
  return db.schedule.update({
    where: { id },
    data: {
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate === undefined ? undefined : data.endDate ? new Date(data.endDate) : null,
    },
  })
}

export async function deleteSchedule(id: string) {
  const schedule = await db.schedule.findFirst({ where: { id } })
  if (!schedule) return

  return db.$transaction(async (tx) => {
    // Eliminar asignaciones de entrenadores solo para días que no cubre ningún otro horario del grupo
    if (schedule.weekDays.length > 0) {
      const remainingSchedules = await tx.schedule.findMany({
        where: { groupId: schedule.groupId, id: { not: id } },
        select: { weekDays: true },
      })
      const coveredByOthers = new Set(remainingSchedules.flatMap((s) => s.weekDays))
      const daysToRemove = schedule.weekDays.filter((d) => !coveredByOthers.has(d))

      if (daysToRemove.length > 0) {
        const trainerGroups = await tx.trainerGroup.findMany({
          where: { groupId: schedule.groupId },
          select: { id: true },
        })
        const trainerGroupIds = trainerGroups.map((tg) => tg.id)

        if (trainerGroupIds.length > 0) {
          await tx.trainerGroupSchedule.deleteMany({
            where: {
              trainerGroupId: { in: trainerGroupIds },
              weekDay: { in: daysToRemove },
            },
          })
        }
      }
    }

    await tx.schedule.delete({ where: { id } })
  })
}
