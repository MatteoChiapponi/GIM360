import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym } from "@/modules/belongs/belongs.service"
import { getGroupById, updateGroup, deleteGroup } from "@/modules/groups/groups.service"
import { updateGroupSchema } from "@/modules/groups/groups.schema"
import { logger } from "@/lib/logger"

type Params = { id: string }

export const GET = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await groupBelongsToGym(id, gymId)) {
    logger.warn("groupBelongsToGym failed", { groupId: id, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const group = await getGroupById(id)
  if (!group) {
    logger.warn("Group not found", { id })
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(group)
})

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

  if (!await groupBelongsToGym(id, gymId)) {
    logger.warn("groupBelongsToGym failed", { groupId: id, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateGroupSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await updateGroup(id, parsed.data)
  logger.info("Group updated", { id })
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

  if (!await groupBelongsToGym(id, gymId)) {
    logger.warn("groupBelongsToGym failed", { groupId: id, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await deleteGroup(id)
  logger.info("Group deleted", { id })
  return new NextResponse(null, { status: 204 })
})
