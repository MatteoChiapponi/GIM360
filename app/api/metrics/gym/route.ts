import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { metricsQuerySchema } from "@/modules/metrics/metrics.schema"
import { getGymMetrics } from "@/modules/metrics/gym/gym-metrics.service"

export const GET = withAuth([UserRole.OWNER], async (req, session) => {
  const parsed = metricsQuerySchema.safeParse({
    gymId: req.nextUrl.searchParams.get("gymId"),
    period: req.nextUrl.searchParams.get("period"),
  })
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!await gymBelongsToOwner(parsed.data.gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await getGymMetrics(parsed.data))
})
