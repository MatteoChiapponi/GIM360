import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { createOwnerSchema } from "@/modules/admin/admin.schema"
import { getAllOwners, createOwnerWithUser } from "@/modules/admin/admin.service"
import { logger } from "@/lib/logger"

export const GET = withAuth([UserRole.ADMIN], async () => {
  return NextResponse.json(await getAllOwners())
})

export const POST = withAuth([UserRole.ADMIN], async (req) => {
  const body = await req.json()
  const parsed = createOwnerSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const owner = await createOwnerWithUser(parsed.data)
    logger.info("Owner created by admin", { id: owner.id })
    return NextResponse.json(owner, { status: 201 })
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "El email ya está en uso" }, { status: 409 })
    }
    logger.error("createOwnerWithUser failed", { error: String(err) })
    throw err
  }
})
