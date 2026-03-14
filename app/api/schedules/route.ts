import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym } from "@/modules/belongs/belongs.service"
import { createSchedule } from "@/modules/schedules/schedules.service"
import { createScheduleSchema } from "@/modules/schedules/schedules.schema"

export const POST = withAuth([UserRole.OWNER], async (req, session) => {
  const body = await req.json()
  const parsed = createScheduleSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // Resolve gymId via query param (groupId is in body)
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await groupBelongsToGym(parsed.data.groupId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await createSchedule(parsed.data), { status: 201 })
})
