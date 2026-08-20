import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner, gymBelongsToUser, gymIsActive } from "@/modules/belongs/belongs.service"
import { getLateFeeConfig, updateLateFeeConfig } from "@/modules/late-fees/late-fees.service"
import { updateLateFeeConfigSchema } from "@/modules/late-fees/late-fees.schema"
import { logger } from "@/lib/logger"

/** La regla de mora del gimnasio. El recepcionista la necesita para cobrar. */
export const GET = withAuth([UserRole.OWNER, UserRole.RECEPTIONIST], async (req, session) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToUser(gymId, session.user.id)) {
    logger.warn("gymBelongsToUser failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(await getLateFeeConfig(gymId))
})

/** Solo el dueño define el recargo por mora. */
export const PATCH = withAuth([UserRole.OWNER], async (req, session) => {
  const body = await req.json()
  const parsed = updateLateFeeConfigSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { gymId, ...config } = parsed.data

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await gymIsActive(gymId)) {
    logger.warn("Gym inactive or suspended", { gymId })
    return NextResponse.json({ error: "Gym is suspended or inactive" }, { status: 403 })
  }

  const result = await updateLateFeeConfig(gymId, config)
  logger.info("Late fee config updated", { gymId, enabled: config.enabled, frequency: config.frequency })
  return NextResponse.json(result)
})
