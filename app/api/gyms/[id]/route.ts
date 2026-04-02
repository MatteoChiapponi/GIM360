import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { updateGymSchema } from "@/modules/gyms/gyms.schema"
import { getGymById, updateGym, deleteGym } from "@/modules/gyms/gyms.service"
import { logger } from "@/lib/logger"

export const GET = withAuthParams<{ id: string }>([UserRole.OWNER], async (_req, session, { id }) => {
  const gym = await getGymById(id)
  if (!gym) {
    logger.warn("Gym not found", { id })
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!await gymBelongsToOwner(gym.id, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId: gym.id, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return NextResponse.json(gym)
})

export const PATCH = withAuthParams<{ id: string }>([UserRole.OWNER], async (req, session, { id }) => {
  const gym = await getGymById(id)
  if (!gym) {
    logger.warn("Gym not found", { id })
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!await gymBelongsToOwner(gym.id, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId: gym.id, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const body = await req.json()
  const parsed = updateGymSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const result = await updateGym(id, parsed.data)
  logger.info("Gym updated", { id })
  return NextResponse.json(result)
})

export const DELETE = withAuthParams<{ id: string }>([UserRole.OWNER], async (_req, session, { id }) => {
  const gym = await getGymById(id)
  if (!gym) {
    logger.warn("Gym not found", { id })
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (!await gymBelongsToOwner(gym.id, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId: gym.id, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  await deleteGym(id)
  logger.info("Gym deleted", { id })
  return new NextResponse(null, { status: 204 })
})
