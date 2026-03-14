import { db } from "@/lib/db"
import type { CreateExpenseInput, UpdateExpenseInput } from "./expenses.schema"

export async function getExpensesByGym(gymId: string) {
  return db.fixedExpense.findMany({
    where: { gymId },
    orderBy: { createdAt: "asc" },
  })
}

export async function createExpense(data: CreateExpenseInput) {
  return db.fixedExpense.create({ data })
}

export async function updateExpense(id: string, data: UpdateExpenseInput) {
  return db.fixedExpense.update({ where: { id }, data })
}

export async function deleteExpense(id: string) {
  return db.fixedExpense.delete({ where: { id } })
}
