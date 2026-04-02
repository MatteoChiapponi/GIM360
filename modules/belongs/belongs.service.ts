import { db } from "@/lib/db"

/** Verifica si el gimnasio pertenece al owner (por userId del User) */
export async function gymBelongsToOwner(gymId: string, userId: string): Promise<boolean> {
  const gym = await db.gym.findFirst({ where: { id: gymId, owner: { userId } } })
  return !!gym
}

/** Verifica si el usuario tiene acceso al gimnasio por cualquier rol (Owner o Trainer) */
export async function gymBelongsToUser(gymId: string, userId: string): Promise<boolean> {
  const ownerMatch = await db.gym.findFirst({ where: { id: gymId, owner: { userId } } })
  if (ownerMatch) return true

  const trainerMatch = await db.trainer.findFirst({ where: { gymId, userId } })
  if (trainerMatch) return true

  return false
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

/** Verifica si el gasto fijo pertenece al gimnasio */
export async function expenseBelongsToGym(expenseId: string, gymId: string): Promise<boolean> {
  const expense = await db.fixedExpense.findFirst({ where: { id: expenseId, gymId } })
  return !!expense
}

/** Verifica si el gimnasio está activo (status === ACTIVE) */
export async function gymIsActive(gymId: string): Promise<boolean> {
  const gym = await db.gym.findFirst({ where: { id: gymId, status: "ACTIVE" } })
  return !!gym
}

/** Verifica si el cierre de caja pertenece al gimnasio */
export async function cashClosingBelongsToGym(closingId: string, gymId: string): Promise<boolean> {
  const closing = await db.cashClosing.findFirst({ where: { id: closingId, gymId } })
  return !!closing
}

/** Verifica si el registro de asistencia pertenece al gimnasio */
export async function attendanceBelongsToGym(attendanceId: string, gymId: string): Promise<boolean> {
  const record = await db.attendance.findFirst({ where: { id: attendanceId, gymId } })
  return !!record
}

/** Verifica si el trainer tiene acceso al registro de asistencia (via asignación al grupo) */
export async function trainerCanAccessAttendance(trainerId: string, attendanceId: string): Promise<boolean> {
  const attendance = await db.attendance.findFirst({ where: { id: attendanceId } })
  if (!attendance) return false
  const link = await db.trainerGroup.findFirst({ where: { trainerId, groupId: attendance.groupId } })
  return !!link
}
