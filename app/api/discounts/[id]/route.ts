import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, discountBelongsToGym } from "@/modules/belongs/belongs.service"
import { getDiscountById, updateDiscount, deleteDiscount } from "@/modules/discounts/discounts.service"
import { updateDiscountSchema } from "@/modules/discounts/discounts.schema"
import { discountError } from "@/modules/discounts/discounts.errors"
import { logger } from "@/lib/logger"

type Params = { id: string }

/** auth de rol la hace el wrapper; acá va gym → descuento. */
async function authorize(gymId: string | null, discountId: string, userId: string) {
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }
  if (!await gymBelongsToOwner(gymId, userId)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!await discountBelongsToGym(discountId, gymId)) {
    logger.warn("discountBelongsToGym failed", { discountId, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export const GET = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const denied = await authorize(req.nextUrl.searchParams.get("gymId"), id, session.user.id)
  if (denied) return denied

  const discount = await getDiscountById(id)
  if (!discount) {
    logger.warn("Discount not found", { id })
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(discount)
})

export const PATCH = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const denied = await authorize(req.nextUrl.searchParams.get("gymId"), id, session.user.id)
  if (denied) return denied

  const body = await req.json()
  const parsed = updateDiscountSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await updateDiscount(id, parsed.data)
    logger.info("Discount updated", { id })
    return NextResponse.json(result)
  } catch (err) {
    if (String(err).includes("Unique constraint")) {
      logger.warn("Duplicate discount name", { id, name: parsed.data.name })
      return NextResponse.json({ error: "Ya existe un descuento con ese nombre" }, { status: 409 })
    }
    logger.error("Discount update failed", { error: String(err), id })
    throw err
  }
})

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const denied = await authorize(req.nextUrl.searchParams.get("gymId"), id, session.user.id)
  if (denied) return denied

  try {
    await deleteDiscount(id)
    logger.info("Discount deleted", { id })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const mapped = discountError(err)
    if (mapped) {
      logger.warn("Discount deletion rejected", { id, reason: String(err) })
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }
    logger.error("Discount deletion failed", { error: String(err), id })
    throw err
  }
})
