import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym } from "@/modules/belongs/belongs.service"
import { updateSchedule, deleteSchedule } from "@/modules/schedules/schedules.service"
import { updateScheduleSchema } from "@/modules/schedules/schedules.schema"
import { db } from "@/lib/db"

type Params = { id: string }

export const PATCH = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const schedule = await db.schedule.findFirst({ where: { id } })
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!await groupBelongsToGym(schedule.groupId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = updateScheduleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  return NextResponse.json(await updateSchedule(id, parsed.data))
})

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const schedule = await db.schedule.findFirst({ where: { id } })
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!await groupBelongsToGym(schedule.groupId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await deleteSchedule(id)
  return new NextResponse(null, { status: 204 })
})
