import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, receptionistBelongsToGym } from "@/modules/belongs/belongs.service"
import { resetReceptionistPassword } from "@/modules/receptionists/receptionists.service"
import { resetReceptionistPasswordSchema } from "@/modules/receptionists/receptionists.schema"
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

  if (!await receptionistBelongsToGym(id, gymId)) {
    logger.warn("receptionistBelongsToGym failed", { receptionistId: id, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = resetReceptionistPasswordSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    await resetReceptionistPassword(id, parsed.data.password)
    logger.info("Receptionist password reset", { id })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      logger.warn("Receptionist not found", { id })
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    logger.error("resetReceptionistPassword failed", { error: String(err), receptionistId: id })
    throw err
  }
})
