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
    orderBy: { nombre: "asc" },
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
