import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym } from "@/modules/belongs/belongs.service"
import { updateSchedule, deleteSchedule } from "@/modules/schedules/schedules.service"
import { updateScheduleSchema } from "@/modules/schedules/schedules.schema"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"

type Params = { id: string }

export const PATCH = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const schedule = await db.schedule.findFirst({ where: { id } })
  if (!schedule) {
    logger.warn("Schedule not found", { id })
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!await groupBelongsToGym(schedule.groupId, gymId)) {
    logger.warn("groupBelongsToGym failed", { groupId: schedule.groupId, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateScheduleSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await updateSchedule(id, parsed.data)
  logger.info("Schedule updated", { id })
  return NextResponse.json(result)
})

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const schedule = await db.schedule.findFirst({ where: { id } })
  if (!schedule) {
    logger.warn("Schedule not found", { id })
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (!await groupBelongsToGym(schedule.groupId, gymId)) {
    logger.warn("groupBelongsToGym failed", { groupId: schedule.groupId, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await deleteSchedule(id)
  logger.info("Schedule deleted", { id })
  return new NextResponse(null, { status: 204 })
})
