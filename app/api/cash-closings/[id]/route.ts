import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { cashClosingBelongsToGym, gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { getCashClosingById } from "@/modules/cash-closings/cash-closings.service"
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

  if (!await cashClosingBelongsToGym(id, gymId)) {
    logger.warn("cashClosingBelongsToGym failed", { cashClosingId: id, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const closing = await getCashClosingById(id)
  if (!closing) {
    logger.warn("Cash closing not found", { id })
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(closing)
})
