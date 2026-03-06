import { db } from "@/lib/db"

/** Verifica si el gimnasio pertenece al owner (por userId del User) */
export async function gymBelongsToOwner(gymId: string, userId: string): Promise<boolean> {
  const gym = await db.gym.findFirst({ where: { id: gymId, owner: { userId } } })
  return !!gym
}

/** Verifica si el trainer pertenece al gimnasio */
export async function trainerBelongsToGym(trainerId: string, gymId: string): Promise<boolean> {
  const trainer = await db.trainer.findFirst({ where: { id: trainerId, gymId } })
  return !!trainer
}

/** Verifica si el alumno pertenece al gimnasio */
export async function studentBelongsToGym(studentId: string, gymId: string): Promise<boolean> {
  const student = await db.student.findFirst({ where: { id: studentId, gymId } })
  return !!student
}

/** Verifica si el grupo pertenece al gimnasio */
export async function groupBelongsToGym(groupId: string, gymId: string): Promise<boolean> {
  const group = await db.group.findFirst({ where: { id: groupId, gymId } })
  return !!group
}

/** Verifica si el horario pertenece al grupo */
export async function scheduleBelongsToGroup(scheduleId: string, groupId: string): Promise<boolean> {
  const schedule = await db.schedule.findFirst({ where: { id: scheduleId, groupId } })
  return !!schedule
}

/** Verifica si el trainer está asignado al grupo */
export async function trainerBelongsToGroup(trainerId: string, groupId: string): Promise<boolean> {
  const link = await db.trainerGroup.findFirst({ where: { trainerId, groupId } })
  return !!link
}

/** Verifica si el alumno está inscripto en el grupo */
export async function studentBelongsToGroup(studentId: string, groupId: string): Promise<boolean> {
  const link = await db.studentGroup.findFirst({ where: { studentId, groupId } })
  return !!link
}

/** Verifica si el pago pertenece al gimnasio */
export async function paymentBelongsToGym(paymentId: string, gymId: string): Promise<boolean> {
  const payment = await db.payment.findFirst({ where: { id: paymentId, gymId } })
  return !!payment
}
