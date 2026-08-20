import { NextRequest, NextResponse } from "next/server"
import { UserRole, PaymentMethod } from "@/app/generated/prisma/client"
import { db } from "@/lib/db"
import { withAuthParams } from "@/lib/with-auth"
import { paymentBelongsToGym, gymIsActive, gymBelongsToUser, gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { updatePayment, deletePayment } from "@/modules/payments/payments.service"
import { updatePaymentSchema } from "@/modules/payments/payments.schema"
import { applyMethodAdjustment, getPaymentMethodConfig } from "@/modules/payment-methods/payment-methods.service"
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

  const existing = await db.payment.findUnique({ where: { id } })
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

  // Al despagar se descarta el ajuste y el monto vuelve al valor de la cuota
  if (parsed.data.status && parsed.data.status !== "PAID") {
    const { paymentMethod: _ignored, ...rest } = parsed.data
    const result = await updatePayment(id, {
      ...rest,
      amount: rest.amount ?? (existing.baseAmount !== null ? Number(existing.baseAmount) : undefined),
      paymentMethod: null,
      baseAmount: null,
      methodAdjustment: null,
    })
    logger.info("Payment updated", { id })
    return NextResponse.json(result)
  }

  // Quitar el medio de pago sin despagar: el ajuste se va con él
  if (parsed.data.paymentMethod === null) {
    const result = await updatePayment(id, {
      ...parsed.data,
      amount: parsed.data.amount ?? (existing.baseAmount !== null ? Number(existing.baseAmount) : undefined),
      baseAmount: null,
      methodAdjustment: null,
    })
    logger.info("Payment updated", { id })
    return NextResponse.json(result)
  }

  // Medio de pago que rige el cobro: el que viene en el body o, si solo se está
  // editando el monto de un pago ya cobrado, el que tenía guardado.
  const method = parsed.data.paymentMethod ?? existing.paymentMethod

  // Solo se recalcula si el cambio afecta al cobro. Editar una nota no puede
  // mover el monto de un pago viejo porque la config del gimnasio cambió después.
  const repricing =
    parsed.data.paymentMethod !== undefined ||
    parsed.data.amount !== undefined ||
    parsed.data.status === "PAID"

  if (method && repricing) {
    const config = await getPaymentMethodConfig(gymId, method)
    if (!config.enabled) {
      logger.warn("Disabled payment method", { paymentId: id, gymId, method })
      return NextResponse.json({ error: "El medio de pago no está habilitado" }, { status: 400 })
    }

    // El monto de la cuota antes del ajuste: el que se manda, el que ya estaba
    // guardado como base, o el monto actual si el pago todavía no tenía ajuste.
    const baseAmount = parsed.data.amount ?? Number(existing.baseAmount ?? existing.amount)
    const { amount, adjustment } = applyMethodAdjustment(baseAmount, config)

    const result = await updatePayment(id, {
      ...parsed.data,
      paymentMethod: method,
      amount,
      baseAmount,
      methodAdjustment: adjustment,
    })
    logger.info("Payment updated", { id, method, baseAmount, adjustment, amount })
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
