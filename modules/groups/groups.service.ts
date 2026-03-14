import { db } from "@/lib/db"
import type { CreateGroupInput, UpdateGroupInput } from "./groups.schema"

export async function getGroupsByGym(gymId: string) {
  return db.group.findMany({
    where: { gymId },
    include: {
      trainers: { include: { trainer: true } },
      schedules: true,
      _count: { select: { students: true } },
    },
    orderBy: { name: "asc" },
  })
}

export async function getGroupById(id: string) {
  return db.group.findFirst({
    where: { id },
    include: {
      trainers: { include: { trainer: true } },
      students: { include: { student: true } },
      schedules: true,
    },
  })
}

export async function createGroup(data: CreateGroupInput) {
  return db.group.create({ data })
}

export async function updateGroup(id: string, data: UpdateGroupInput) {
  return db.group.update({ where: { id }, data })
}

export async function deleteGroup(id: string) {
  return db.group.delete({ where: { id } })
}

export async function enrollStudent(groupId: string, studentId: string) {
  return db.studentGroup.create({ data: { groupId, studentId } })
}

export async function unenrollStudent(groupId: string, studentId: string) {
  return db.studentGroup.delete({
    where: { studentId_groupId: { studentId, groupId } },
  })
}

export async function assignTrainer(groupId: string, trainerId: string, hourlyRate?: number) {
  return db.trainerGroup.create({
    data: { groupId, trainerId, ...(hourlyRate !== undefined ? { hourlyRate } : {}) },
  })
}

export async function removeTrainer(groupId: string, trainerId: string) {
  return db.trainerGroup.delete({
    where: { trainerId_groupId: { trainerId, groupId } },
  })
}
