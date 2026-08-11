import bcrypt from "bcryptjs"
import { UserRole } from "@/app/generated/prisma/client"
import { db } from "@/lib/db"
import type { CreateReceptionistInput, UpdateReceptionistInput } from "./receptionists.schema"

/**
 * A Receptionist always has an associated User — unlike Trainer, the record only
 * exists to give someone login access to a gym's front desk.
 */

export async function getReceptionistByUserId(userId: string) {
  return db.receptionist.findFirst({
    where: { userId },
    include: { gym: { select: { id: true, name: true, status: true } } },
  })
}

export async function getReceptionistsByGym(gymId: string) {
  return db.receptionist.findMany({
    where: { gymId },
    include: { user: { select: { email: true } } },
    orderBy: { name: "asc" },
  })
}

export async function getReceptionistById(id: string) {
  return db.receptionist.findFirst({
    where: { id },
    include: { user: { select: { email: true } } },
  })
}

export async function createReceptionistWithUser(data: CreateReceptionistInput) {
  const existing = await db.user.findUnique({ where: { email: data.email } })
  if (existing) throw new Error("EMAIL_TAKEN")

  const hashedPassword = await bcrypt.hash(data.password, 12)

  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: data.email, hashedPassword, role: UserRole.RECEPTIONIST },
    })

    return tx.receptionist.create({
      data: { userId: user.id, gymId: data.gymId, name: data.name },
      include: { user: { select: { email: true } } },
    })
  })
}

export async function updateReceptionist(id: string, data: UpdateReceptionistInput) {
  return db.receptionist.update({
    where: { id },
    data,
    include: { user: { select: { email: true } } },
  })
}

export async function resetReceptionistPassword(id: string, password: string) {
  const receptionist = await db.receptionist.findFirst({ where: { id } })
  if (!receptionist) throw new Error("NOT_FOUND")

  const hashedPassword = await bcrypt.hash(password, 12)
  await db.user.update({ where: { id: receptionist.userId }, data: { hashedPassword } })
}

/** Hard delete — removes the User, which cascades to the Receptionist row. */
export async function deleteReceptionist(id: string) {
  const receptionist = await db.receptionist.findFirst({ where: { id } })
  if (!receptionist) throw new Error("NOT_FOUND")

  await db.user.delete({ where: { id: receptionist.userId } })
}
