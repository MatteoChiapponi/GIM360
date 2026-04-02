import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { getTrainerProfileByUserId } from "@/modules/trainers/trainers.service"
import { logger } from "@/lib/logger"

export const GET = withAuth([UserRole.TRAINER], async (_req, session) => {
  const trainer = await getTrainerProfileByUserId(session.user.id)
  if (!trainer) {
    logger.warn("Trainer not found", { id: session.user.id })
    return NextResponse.json({ error: "Trainer not found" }, { status: 404 })
  }
  return NextResponse.json(trainer)
})
