import { db } from "@/lib/db"
import type { CreateGymInput, UpdateGymInput } from "./gyms.schema"

export async function getGymsByOwner(userId: string) {
  return db.gym.findMany({
    where: { owner: { userId } },
    orderBy: { createdAt: "desc" },
  })
}

export async function getGymById(id: string) {
  return db.gym.findFirst({ where: { id } })
}

export async function createGym(userId: string, data: CreateGymInput) {
  const owner = await db.owner.findFirst({ where: { userId } })
  if (!owner) throw new Error("Owner not found")
  return db.gym.create({ data: { ...data, ownerId: owner.id } })
}

export async function updateGym(id: string, data: UpdateGymInput) {
  return db.gym.update({ where: { id }, data })
}

export async function deleteGym(id: string) {
  return db.gym.delete({ where: { id } })
}

export async function getOwnerByUserId(userId: string) {
  return db.owner.findFirst({ where: { userId }, select: { id: true, name: true } })
}
