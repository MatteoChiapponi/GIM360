import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { getReceptionistsByGym, createReceptionistWithUser } from "@/modules/receptionists/receptionists.service"
import { createReceptionistSchema } from "@/modules/receptionists/receptionists.schema"
import { logger } from "@/lib/logger"

export const GET = withAuth([UserRole.OWNER], async (req, session) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(await getReceptionistsByGym(gymId))
})

export const POST = withAuth([UserRole.OWNER], async (req, session) => {
  const body = await req.json()
  const parsed = createReceptionistSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!await gymBelongsToOwner(parsed.data.gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId: parsed.data.gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const result = await createReceptionistWithUser(parsed.data)
    logger.info("Receptionist created", { id: result.id })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      logger.warn("Email already registered", { email: parsed.data.email })
      return NextResponse.json({ error: "El email ya está registrado en GYM360." }, { status: 409 })
    }
    logger.error("createReceptionistWithUser failed", { error: String(err), gymId: parsed.data.gymId })
    throw err
  }
})
