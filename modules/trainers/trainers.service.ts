import { db } from "@/lib/db"
import type { CreateTrainerInput, UpdateTrainerInput } from "./trainers.schema"

export async function getTrainersByGym(gymId: string) {
  return db.trainer.findMany({
    where: { gymId },
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
  return db.trainer.create({ data })
}

export async function updateTrainer(id: string, data: UpdateTrainerInput) {
  return db.trainer.update({ where: { id }, data })
}

// Soft delete: trainer has active Boolean
export async function deleteTrainer(id: string) {
  return db.trainer.update({ where: { id }, data: { active: false } })
}
