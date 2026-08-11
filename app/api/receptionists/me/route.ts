import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { getReceptionistByUserId } from "@/modules/receptionists/receptionists.service"
import { logger } from "@/lib/logger"

export const GET = withAuth([UserRole.RECEPTIONIST], async (_req, session) => {
  const receptionist = await getReceptionistByUserId(session.user.id)
  if (!receptionist) {
    logger.warn("Receptionist not found", { id: session.user.id })
    return NextResponse.json({ error: "Receptionist not found" }, { status: 404 })
  }
  return NextResponse.json(receptionist)
})
