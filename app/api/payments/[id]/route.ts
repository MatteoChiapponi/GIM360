import { NextRequest, NextResponse } from "next/server"
import { UserRole, PaymentMethod } from "@/app/generated/prisma/client"
import { db } from "@/lib/db"
import { withAuthParams } from "@/lib/with-auth"
import { paymentBelongsToGym, gymIsActive, gymBelongsToUser, gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { updatePayment, deletePayment, setDiscountOverride } from "@/modules/payments/payments.service"
import { updatePaymentSchema } from "@/modules/payments/payments.schema"
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

  // Block modifications on verified (archived) payments
  const existing = await db.payment.findUnique({ where: { id } })
  if (existing?.verified) {
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

  // Clear paymentMethod when un-marking as PAID
  if (parsed.data.status && parsed.data.status !== "PAID") {
    const { paymentMethod: _, ...rest } = parsed.data
    const result = await updatePayment(id, Object.assign(rest, { paymentMethod: null }))
    logger.info("Payment updated", { id })
    return NextResponse.json(result)
  }

  const result = await updatePayment(id, parsed.data)
  logger.info("Payment updated", { id })
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
