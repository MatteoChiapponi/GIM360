import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym } from "@/modules/belongs/belongs.service"
import { createSchedule } from "@/modules/schedules/schedules.service"
import { createScheduleSchema } from "@/modules/schedules/schedules.schema"
import { logger } from "@/lib/logger"

export const POST = withAuth([UserRole.OWNER], async (req, session) => {
  const body = await req.json()
  const parsed = createScheduleSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Resolve gymId via query param (groupId is in body)
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await groupBelongsToGym(parsed.data.groupId, gymId)) {
    logger.warn("groupBelongsToGym failed", { groupId: parsed.data.groupId, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const result = await createSchedule(parsed.data)
  logger.info("Schedule created", { id: result.id })
  return NextResponse.json(result, { status: 201 })
})
