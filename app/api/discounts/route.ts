import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { getDiscountsByGym, createDiscount } from "@/modules/discounts/discounts.service"
import { createDiscountSchema } from "@/modules/discounts/discounts.schema"
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

  return NextResponse.json(await getDiscountsByGym(gymId))
})

export const POST = withAuth([UserRole.OWNER], async (req, session) => {
  const body = await req.json()
  const parsed = createDiscountSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!await gymBelongsToOwner(parsed.data.gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId: parsed.data.gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const result = await createDiscount(parsed.data)
    logger.info("Discount created", { id: result.id })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (String(err).includes("Unique constraint")) {
      logger.warn("Duplicate discount name", { gymId: parsed.data.gymId, name: parsed.data.name })
      return NextResponse.json({ error: "Ya existe un descuento con ese nombre" }, { status: 409 })
    }
    logger.error("Discount creation failed", { error: String(err), gymId: parsed.data.gymId })
    throw err
  }
})
