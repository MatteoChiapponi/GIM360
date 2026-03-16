import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym, trainerBelongsToGym } from "@/modules/belongs/belongs.service"
import { assignTrainer, getGroupById } from "@/modules/groups/groups.service"
import { assignTrainerSchema } from "@/modules/groups/groups.schema"

type Params = { id: string }

export const POST = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id: groupId }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await groupBelongsToGym(groupId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = assignTrainerSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!await trainerBelongsToGym(parsed.data.trainerId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

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

  return NextResponse.json(await assignTrainer(groupId, parsed.data), { status: 201 })
})
