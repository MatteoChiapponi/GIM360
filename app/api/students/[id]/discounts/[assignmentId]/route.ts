import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, studentBelongsToGym, assignmentBelongsToStudent } from "@/modules/belongs/belongs.service"
import { updateStudentDiscount, removeStudentDiscount } from "@/modules/discounts/discounts.service"
import { updateAssignmentSchema } from "@/modules/discounts/discounts.schema"
import { discountError } from "@/modules/discounts/discounts.errors"
import { logger } from "@/lib/logger"

type Params = { id: string; assignmentId: string }

/** El gate de rol lo hizo el wrapper; acá va gym → alumno → asignación. */
async function authorize(gymId: string | null, studentId: string, assignmentId: string, userId: string) {
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
  if (!await assignmentBelongsToStudent(assignmentId, studentId)) {
    logger.warn("assignmentBelongsToStudent failed", { assignmentId, studentId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export const PATCH = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id, assignmentId }) => {
  const denied = await authorize(req.nextUrl.searchParams.get("gymId"), id, assignmentId, session.user.id)
  if (denied) return denied

  const body = await req.json()
  const parsed = updateAssignmentSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await updateStudentDiscount(assignmentId, parsed.data)
    logger.info("Student discount updated", { id: assignmentId, studentId: id })
    return NextResponse.json(result)
  } catch (err) {
    const mapped = discountError(err)
    if (mapped) {
      logger.warn("Student discount update rejected", { id: assignmentId, reason: String(err) })
      return NextResponse.json({ error: mapped.error }, { status: mapped.status })
    }
    logger.error("Student discount update failed", { error: String(err), id: assignmentId })
    throw err
  }
})

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id, assignmentId }) => {
  const denied = await authorize(req.nextUrl.searchParams.get("gymId"), id, assignmentId, session.user.id)
  if (denied) return denied

  await removeStudentDiscount(assignmentId)
  logger.info("Student discount removed", { id: assignmentId, studentId: id })
  return new NextResponse(null, { status: 204 })
})
