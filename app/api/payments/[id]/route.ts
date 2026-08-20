import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { db } from "@/lib/db"
import { withAuthParams } from "@/lib/with-auth"
import { paymentBelongsToGym, gymIsActive, gymBelongsToUser, gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { updatePayment, deletePayment } from "@/modules/payments/payments.service"
import { updatePaymentSchema } from "@/modules/payments/payments.schema"
import { resolvePaymentAmounts } from "@/modules/payments/payments.pricing"
import { logger } from "@/lib/logger"

type Params = { id: string }

export const PATCH = withAuthParams<Params>([UserRole.OWNER, UserRole.RECEPTIONIST], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToUser(gymId, session.user.id)) {
    logger.warn("gymBelongsToUser failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await paymentBelongsToGym(id, gymId)) {
    logger.warn("paymentBelongsToGym failed", { paymentId: id, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await gymIsActive(gymId)) {
    logger.warn("Gym inactive or suspended", { gymId })
    return NextResponse.json({ error: "Gym is suspended or inactive" }, { status: 403 })
  }

  // El alumno viene con el pago: la mora se calcula sobre su día de vencimiento.
  const existing = await db.payment.findUnique({
    where: { id },
    include: { student: { select: { dueDay: true, lateFeeExempt: true } } },
  })
  if (!existing) {
    logger.warn("Payment not found", { paymentId: id, gymId })
    return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 })
  }

  // Block modifications on verified (archived) payments
  if (existing.verified) {
    logger.warn("Attempt to modify verified payment", { paymentId: id, gymId })
    return NextResponse.json({ error: "No se puede modificar un pago verificado" }, { status: 409 })
  }

  const body = await req.json()
  const parsed = updatePaymentSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Require paymentMethod when marking as PAID
  if (parsed.data.status === "PAID" && !parsed.data.paymentMethod) {
    logger.warn("paymentMethod required when marking as PAID", { paymentId: id })
    return NextResponse.json({ error: "paymentMethod es requerido al marcar como pagado" }, { status: 400 })
  }

  const pricing = await resolvePaymentAmounts(gymId, existing, parsed.data)
  if (!pricing.ok) {
    logger.warn("Disabled payment method", { paymentId: id, gymId, method: pricing.disabledMethod })
    return NextResponse.json({ error: "El medio de pago no está habilitado" }, { status: 400 })
  }

  const result = await updatePayment(id, { ...parsed.data, ...pricing.fields })
  logger.info("Payment updated", { id, ...pricing.fields })
  return NextResponse.json(result)
})

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await paymentBelongsToGym(id, gymId)) {
    logger.warn("paymentBelongsToGym failed", { paymentId: id, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await gymIsActive(gymId)) {
    logger.warn("Gym inactive or suspended", { gymId })
    return NextResponse.json({ error: "Gym is suspended or inactive" }, { status: 403 })
  }

  await deletePayment(id)
  logger.info("Payment deleted", { id })
  return new NextResponse(null, { status: 204 })
})
