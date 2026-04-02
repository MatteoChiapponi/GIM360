import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { createAdminGymSchema } from "@/modules/admin/admin.schema"
import { getAllGyms, createGymForOwner } from "@/modules/admin/admin.service"
import { logger } from "@/lib/logger"

export const GET = withAuth([UserRole.ADMIN], async () => {
  return NextResponse.json(await getAllGyms())
})

export const POST = withAuth([UserRole.ADMIN], async (req) => {
  const body = await req.json()
  const parsed = createAdminGymSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await createGymForOwner(parsed.data)
  logger.info("Gym created by admin", { id: result.id })
  return NextResponse.json(result, { status: 201 })
})
