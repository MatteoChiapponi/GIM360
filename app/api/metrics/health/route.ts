import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { metricsQuerySchema } from "@/modules/metrics/metrics.schema"
import { getHealthIndexMetrics } from "@/modules/metrics/health/health-metrics.service"
import { logger } from "@/lib/logger"

export const GET = withAuth([UserRole.OWNER], async (req, session) => {
  const parsed = metricsQuerySchema.safeParse({
    gymId: req.nextUrl.searchParams.get("gymId"),
    period: req.nextUrl.searchParams.get("period"),
  })
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!await gymBelongsToOwner(parsed.data.gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId: parsed.data.gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(await getHealthIndexMetrics(parsed.data))
})
