import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, studentBelongsToGym, discountBelongsToGym } from "@/modules/belongs/belongs.service"
import { getStudentDiscounts, assignDiscountToStudent } from "@/modules/discounts/discounts.service"
import { assignDiscountSchema } from "@/modules/discounts/discounts.schema"
import { discountError } from "@/modules/discounts/discounts.errors"
import { logger } from "@/lib/logger"

type Params = { id: string }

/** El gate de rol lo hizo el wrapper; acá va gym → alumno. */
async function authorize(gymId: string | null, studentId: string, userId: string) {
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }
  if (!await gymBelongsToOwner(gymId, userId)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!await studentBelongsToGym(studentId, gymId)) {
    logger.warn("studentBelongsToGym failed", { studentId, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export const GET = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const denied = await authorize(req.nextUrl.searchParams.get("gymId"), id, session.user.id)
  if (denied) return denied

  return NextResponse.json(await getStudentDiscounts(id))
})

export const POST = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  const denied = await authorize(gymId, id, session.user.id)
  if (denied) return denied

  const body = await req.json()
  const parsed = assignDiscountSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Un descuento solo se asigna dentro de su propio gimnasio, aunque el owner
  // tenga varios.
  if (!await discountBelongsToGym(parsed.data.discountId, gymId!)) {
    logger.warn("discountBelongsToGym failed", { discountId: parsed.data.discountId, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const result = await assignDiscountToStudent(id, parsed.data)
    logger.info("Discount assigned to student", { id: result.id, studentId: id, discountId: parsed.data.discountId })
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    const mapped = discountError(err)
    if (mapped) {
      logger.warn("Discount assignment rejected", { studentId: id, reason: String(err) })
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }
    logger.error("Discount assignment failed", { error: String(err), studentId: id })
    throw err
  }
})
