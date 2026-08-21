import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { db } from "@/lib/db"
import { withAuthParams } from "@/lib/with-auth"
import { paymentBelongsToGym, gymIsActive, gymBelongsToUser, gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { updatePayment, deletePayment, setDiscountOverride } from "@/modules/payments/payments.service"
import { updatePaymentSchema, persistablePaymentSchema } from "@/modules/payments/payments.schema"
import { resolvePaymentAmounts } from "@/modules/payments/payments.pricing"
import { paymentError } from "@/modules/payments/payments.errors"
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

  // Aplicar o sacar el descuento a mano: el monto lo recalcula el servicio, así
  // que va por su propio camino y no se mezcla con el resto del update.
  if (parsed.data.discountOverride !== undefined) {
    try {
      const result = await setDiscountOverride(id, parsed.data.discountOverride)
      logger.info("Payment discount override set", { id, override: parsed.data.discountOverride })
      return NextResponse.json(result)
    } catch (err) {
      const mapped = paymentError(err)
      if (mapped) {
        logger.warn("Payment discount override rejected", { id, reason: String(err) })
        return NextResponse.json({ error: mapped.error }, { status: mapped.status })
      }
      logger.error("Payment discount override failed", { error: String(err), id })
      throw err
    }
  }

  // Require paymentMethod when marking as PAID
  if (parsed.data.status === "PAID" && !parsed.data.paymentMethod) {
    logger.warn("paymentMethod required when marking as PAID", { paymentId: id })
    return NextResponse.json({ error: "paymentMethod es requerido al marcar como pagado" }, { status: 400 })
  }

  const pricing = await resolvePaymentAmounts(gymId, existing, parsed.data)
  if (!pricing.ok) {
    if (pricing.error === "disabled-method") {
      logger.warn("Disabled payment method", { paymentId: id, gymId, method: pricing.method })
      return NextResponse.json({ error: "El medio de pago no está habilitado" }, { status: 400 })
    }
    logger.warn("Charged amount without a payment method", { paymentId: id, gymId })
    return NextResponse.json(
      { error: "Solo se puede ajustar el monto al cobrar la cuota" },
      { status: 400 },
    )
  }

  const updates = persistablePaymentSchema.parse(parsed.data)
  const result = await updatePayment(id, { ...updates, ...pricing.fields })
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
