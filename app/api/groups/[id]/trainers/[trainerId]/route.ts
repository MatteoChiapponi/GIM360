import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym, trainerBelongsToGroup } from "@/modules/belongs/belongs.service"
import { removeTrainer, updateTrainerAssignment, getGroupById } from "@/modules/groups/groups.service"
import { updateTrainerAssignmentSchema } from "@/modules/groups/groups.schema"
import { db } from "@/lib/db"

type Params = { id: string; trainerId: string }

export const PATCH = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id: groupId, trainerId }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await groupBelongsToGym(groupId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await trainerBelongsToGroup(trainerId, groupId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = updateTrainerAssignmentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Validate trainer schedule entries against group schedules
  const group = await getGroupById(groupId)
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })

  const groupWeekDays = new Set(group.schedules.flatMap((s) => s.weekDays))

  for (const entry of parsed.data.schedules) {
    if (!groupWeekDays.has(entry.weekDay)) {
      return NextResponse.json(
        { error: `El día ${entry.weekDay} no pertenece al horario del grupo` },
        { status: 400 }
      )
    }

    const groupSchedule = group.schedules.find((s) => s.weekDays.includes(entry.weekDay))
    if (groupSchedule && (entry.startTime < groupSchedule.startTime || entry.endTime > groupSchedule.endTime)) {
      return NextResponse.json(
        { error: `El horario ${entry.startTime}-${entry.endTime} excede el horario del grupo para ${entry.weekDay}` },
        { status: 400 }
      )
    }
  }

  const trainerGroup = await db.trainerGroup.findUnique({
    where: { trainerId_groupId: { trainerId, groupId } },
  })
  if (!trainerGroup) return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 })

  const [, updated] = await updateTrainerAssignment(trainerGroup.id, parsed.data)
  return NextResponse.json(updated)
})

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id: groupId, trainerId }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await groupBelongsToGym(groupId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await trainerBelongsToGroup(trainerId, groupId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await removeTrainer(groupId, trainerId)
  return new NextResponse(null, { status: 204 })
})
