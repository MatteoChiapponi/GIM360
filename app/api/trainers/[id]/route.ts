import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, trainerBelongsToGym } from "@/modules/belongs/belongs.service"
import { updateTrainer, deleteTrainer } from "@/modules/trainers/trainers.service"
import { updateTrainerSchema } from "@/modules/trainers/trainers.schema"
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

  if (!await trainerBelongsToGym(id, gymId)) {
    logger.warn("trainerBelongsToGym failed", { trainerId: id, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateTrainerSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await updateTrainer(id, parsed.data)
  logger.info("Trainer updated", { id })
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

  if (!await trainerBelongsToGym(id, gymId)) {
    logger.warn("trainerBelongsToGym failed", { trainerId: id, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Soft delete: active = false
  await deleteTrainer(id)
  logger.info("Trainer deleted", { id })
  return new NextResponse(null, { status: 204 })
})
