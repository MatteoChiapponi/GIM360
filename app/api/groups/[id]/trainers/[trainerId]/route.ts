import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym, trainerBelongsToGroup } from "@/modules/belongs/belongs.service"
import { removeTrainer, updateTrainerAssignment, getGroupById } from "@/modules/groups/groups.service"
import { updateTrainerAssignmentSchema } from "@/modules/groups/groups.schema"
import { getTrainerScheduleConflicts } from "@/modules/trainers/trainers.service"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

type Params = { id: string; trainerId: string }

const DAY_ES: Record<string, string> = {
  MONDAY: "LUNES", TUESDAY: "MARTES", WEDNESDAY: "MIÉRCOLES",
  THURSDAY: "JUEVES", FRIDAY: "VIERNES", SATURDAY: "SÁBADO", SUNDAY: "DOMINGO",
}

export const PATCH = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id: groupId, trainerId }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await groupBelongsToGym(groupId, gymId)) {
    logger.warn("groupBelongsToGym failed", { groupId, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await trainerBelongsToGroup(trainerId, groupId)) {
    logger.warn("trainerBelongsToGroup failed", { trainerId, groupId: groupId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const forceOverlap = body.forceOverlap === true
  const parsed = updateTrainerAssignmentSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Validate trainer schedule entries against group schedules
  const group = await getGroupById(groupId)
  if (!group) {
    logger.warn("Group not found", { id: groupId })
    return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })
  }

  const groupWeekDays = new Set(group.schedules.flatMap((s) => s.weekDays))

  for (const entry of parsed.data.schedules) {
    if (!groupWeekDays.has(entry.weekDay)) {
      return NextResponse.json(
        { error: `El día ${DAY_ES[entry.weekDay] ?? entry.weekDay} no pertenece al horario del grupo` },
        { status: 400 }
      )
    }

    const groupSchedule = group.schedules.find((s) => s.weekDays.includes(entry.weekDay))
    if (groupSchedule && (entry.startTime < groupSchedule.startTime || entry.endTime > groupSchedule.endTime)) {
      return NextResponse.json(
        { error: `El horario ${entry.startTime}-${entry.endTime} excede el horario del grupo para el ${DAY_ES[entry.weekDay] ?? entry.weekDay}` },
        { status: 400 }
      )
    }
  }

  // Check for schedule overlaps with other groups (warn, not block)
  if (!forceOverlap) {
    const conflicts = await getTrainerScheduleConflicts(trainerId, parsed.data.schedules, groupId)
    if (conflicts.length > 0) {
      return NextResponse.json({
        error: "El profesor tiene horarios superpuestos con otros grupos",
        conflicts: conflicts.map((c) => ({
          weekDay: DAY_ES[c.weekDay] ?? c.weekDay,
          newTime: c.newTime,
          existingTime: c.existingTime,
          groupName: c.groupName,
        })),
      }, { status: 409 })
    }
  }

  const trainerGroup = await db.trainerGroup.findUnique({
    where: { trainerId_groupId: { trainerId, groupId } },
  })
  if (!trainerGroup) {
    logger.warn("TrainerGroup assignment not found", { trainerId, groupId })
    return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 })
  }

  const [, updated] = await updateTrainerAssignment(trainerGroup.id, parsed.data)
  logger.info("Trainer assignment updated", { trainerId, groupId })
  return NextResponse.json(updated)
})

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id: groupId, trainerId }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await groupBelongsToGym(groupId, gymId)) {
    logger.warn("groupBelongsToGym failed", { groupId, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await trainerBelongsToGroup(trainerId, groupId)) {
    logger.warn("trainerBelongsToGroup failed", { trainerId, groupId: groupId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await removeTrainer(groupId, trainerId)
  logger.info("Trainer removed from group", { trainerId, groupId })
  return new NextResponse(null, { status: 204 })
})
