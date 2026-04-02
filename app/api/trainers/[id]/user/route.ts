import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, trainerBelongsToGym } from "@/modules/belongs/belongs.service"
import { assignUserToTrainer, revokeUserFromTrainer, getTrainerById } from "@/modules/trainers/trainers.service"
import { assignTrainerUserSchema } from "@/modules/trainers/trainers.schema"
import { logger } from "@/lib/logger"

type Params = { id: string }

export const POST = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
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

  const trainer = await getTrainerById(id)
  if (trainer?.userId) {
    logger.warn("Trainer already has user assigned", { trainerId: id })
    return NextResponse.json({ error: "El entrenador ya tiene acceso asignado." }, { status: 409 })
  }

  const body = await req.json()
  const parsed = assignTrainerUserSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await assignUserToTrainer(id, parsed.data.email, parsed.data.password)
    logger.info("Trainer user assigned", { id })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN")
      return NextResponse.json({ error: "El email ya está registrado en GYM360." }, { status: 409 })
    logger.error("assignUserToTrainer failed", { error: String(err), trainerId: id })
    throw err
  }
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

  try {
    await revokeUserFromTrainer(id)
    logger.info("Trainer user revoked", { id })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === "NO_USER")
      return NextResponse.json({ error: "El entrenador no tiene acceso asignado." }, { status: 404 })
    logger.error("revokeUserFromTrainer failed", { error: String(err), trainerId: id })
    throw err
  }
})
