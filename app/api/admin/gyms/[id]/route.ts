import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { updateGymStatusSchema } from "@/modules/admin/admin.schema"
import { updateGymStatus } from "@/modules/admin/admin.service"
import { logger } from "@/lib/logger"

export const PATCH = withAuthParams<{ id: string }>([UserRole.ADMIN], async (req, _session, { id }) => {
  const body = await req.json()
  const parsed = updateGymStatusSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await updateGymStatus(id, parsed.data.status)
  logger.info("Gym status updated by admin", { id, status: parsed.data.status })
  return NextResponse.json(result)
})
