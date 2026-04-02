import bcrypt from "bcryptjs"
import { UserRole } from "@/app/generated/prisma/client"
import { db } from "@/lib/db"
import type { CreateTrainerInput, UpdateTrainerInput } from "./trainers.schema"

export async function getTrainerByUserId(userId: string) {
  return db.trainer.findFirst({ where: { userId } })
}

export async function getTrainersByGym(gymId: string) {
  return db.trainer.findMany({
    where: { gymId },
    include: {
      groups: {
        include: {
          group: { select: { id: true, name: true } },
          schedules: { select: { weekDay: true, startTime: true, endTime: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  })
}

export async function getTrainerById(id: string) {
  return db.trainer.findFirst({
    where: { id },
    include: { groups: { include: { group: true } } },
  })
}

export async function createTrainer(data: CreateTrainerInput) {
  return db.trainer.create({
    data: {
      ...data,
      startedAt: data.startedAt ? new Date(data.startedAt) : null,
    },
  })
}

export async function updateTrainer(id: string, data: UpdateTrainerInput) {
  return db.trainer.update({
    where: { id },
    data: {
      ...data,
      startedAt: data.startedAt === undefined ? undefined : data.startedAt ? new Date(data.startedAt) : null,
    },
  })
}

// Soft delete: trainer has active Boolean. Also removes associated User if present.
export async function deleteTrainer(id: string) {
  const trainer = await db.trainer.findFirst({ where: { id } })
  if (trainer?.userId) {
    const userId = trainer.userId
    return db.$transaction(async (tx) => {
      await tx.trainer.update({ where: { id }, data: { active: false, userId: null } })
      await tx.user.delete({ where: { id: userId } })
    })
  }
  return db.trainer.update({ where: { id }, data: { active: false } })
}

export async function getTrainerProfileByUserId(userId: string) {
  return db.trainer.findFirst({
    where: { userId },
    include: {
      gym: { select: { id: true, name: true } },
      groups: {
        include: {
          group: { select: { id: true, name: true } },
          schedules: { select: { weekDay: true, startTime: true, endTime: true } },
        },
      },
    },
  })
}

export async function assignUserToTrainer(trainerId: string, email: string, password: string) {
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) throw new Error("EMAIL_TAKEN")

  const hashedPassword = await bcrypt.hash(password, 10)

  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, hashedPassword, role: UserRole.TRAINER },
    })
    await tx.trainer.update({ where: { id: trainerId }, data: { userId: user.id } })
  })

  return { email, temporaryPassword: password }
}

export async function revokeUserFromTrainer(trainerId: string) {
  const trainer = await db.trainer.findFirst({ where: { id: trainerId } })
  if (!trainer?.userId) throw new Error("NO_USER")

  const userId = trainer.userId

  await db.$transaction(async (tx) => {
    await tx.trainer.update({ where: { id: trainerId }, data: { userId: null } })
    await tx.user.delete({ where: { id: userId } })
  })
}

export type ScheduleConflict = {
  weekDay: string
  newTime: string
  existingTime: string
  groupName: string
}

/**
 * Checks if the proposed schedules overlap with the trainer's existing schedules
 * in OTHER groups (excludes currentGroupId if provided, for edits).
 */
export async function getTrainerScheduleConflicts(
  trainerId: string,
  proposedSchedules: { weekDay: string; startTime: string; endTime: string }[],
  excludeGroupId?: string,
): Promise<ScheduleConflict[]> {
  const trainer = await db.trainer.findFirst({
    where: { id: trainerId },
    include: {
      groups: {
        where: excludeGroupId ? { groupId: { not: excludeGroupId } } : undefined,
        include: {
          group: { select: { name: true } },
          schedules: { select: { weekDay: true, startTime: true, endTime: true } },
        },
      },
    },
  })

  if (!trainer) return []

  const conflicts: ScheduleConflict[] = []

  for (const proposed of proposedSchedules) {
    for (const tg of trainer.groups) {
      for (const existing of tg.schedules) {
        if (existing.weekDay !== proposed.weekDay) continue
        // Overlap: newStart < existingEnd AND newEnd > existingStart
        if (proposed.startTime < existing.endTime && proposed.endTime > existing.startTime) {
          conflicts.push({
            weekDay: proposed.weekDay,
            newTime: `${proposed.startTime}-${proposed.endTime}`,
            existingTime: `${existing.startTime}-${existing.endTime}`,
            groupName: tg.group.name,
          })
        }
      }
    }
  }

  return conflicts
}
