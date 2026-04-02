import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { createGymSchema } from "@/modules/gyms/gyms.schema"
import { getGymsByOwner, getGymById, createGym } from "@/modules/gyms/gyms.service"
import { getTrainerByUserId } from "@/modules/trainers/trainers.service"
import { logger } from "@/lib/logger"

export const GET = withAuth([UserRole.OWNER, UserRole.TRAINER], async (_req, session) => {
  if (session.user.role === UserRole.OWNER) {
    return NextResponse.json(await getGymsByOwner(session.user.id))
  }

  const trainer = await getTrainerByUserId(session.user.id)
  if (!trainer) {
    logger.warn("Trainer not found", { id: session.user.id })
    return NextResponse.json({ error: "Trainer not found" }, { status: 404 })
  }
  const gym = await getGymById(trainer.gymId)
  return NextResponse.json(gym ? [gym] : [])
})

export const POST = withAuth([UserRole.OWNER], async (req, session) => {
  const body = await req.json()
  const parsed = createGymSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await createGym(session.user.id, parsed.data)
  logger.info("Gym created", { id: result.id })
  return NextResponse.json(result, { status: 201 })
})
