import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner, gymIsActive, studentBelongsToGym } from "@/modules/belongs/belongs.service"
import { generateMonthlyPayments, getPaymentsByGym, getPaymentsByStudent } from "@/modules/payments/payments.service"
import { generatePaymentsSchema } from "@/modules/payments/payments.schema"
import { logger } from "@/lib/logger"

export const GET = withAuth([UserRole.OWNER, UserRole.RECEPTIONIST], async (req, session) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  const studentId = req.nextUrl.searchParams.get("studentId")
  const period = req.nextUrl.searchParams.get("period")

  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await gymIsActive(gymId)) {
    logger.warn("Gym inactive or suspended", { gymId })
    return NextResponse.json({ error: "Gym is suspended or inactive" }, { status: 403 })
  }

  // Student payment history
  if (studentId) {
    if (!await studentBelongsToGym(studentId, gymId)) {
      logger.warn("studentBelongsToGym failed", { studentId, gymId })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    return NextResponse.json(await getPaymentsByStudent(studentId))
  }

  if (!period) {
    logger.warn("Missing required param: period")
    return NextResponse.json({ error: "period required" }, { status: 400 })
  }

  return NextResponse.json(await getPaymentsByGym(gymId, period))
})

export const POST = withAuth([UserRole.OWNER, UserRole.RECEPTIONIST], async (req, session) => {
  const body = await req.json()
  const parsed = generatePaymentsSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { gymId, period } = parsed.data

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await gymIsActive(gymId)) {
    logger.warn("Gym inactive or suspended", { gymId })
    return NextResponse.json({ error: "Gym is suspended or inactive" }, { status: 403 })
  }

  const result = await generateMonthlyPayments(gymId, period)
  logger.info("Monthly payments generated", { gymId, period, count: result.length })
  return NextResponse.json(result, { status: 201 })
})
