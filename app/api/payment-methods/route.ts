import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner, gymBelongsToUser, gymIsActive } from "@/modules/belongs/belongs.service"
import {
  getPaymentMethodConfigs,
  updatePaymentMethodConfigs,
} from "@/modules/payment-methods/payment-methods.service"
import { updatePaymentMethodConfigsSchema } from "@/modules/payment-methods/payment-methods.schema"
import { logger } from "@/lib/logger"

/** Los tres medios de pago del gimnasio. El recepcionista los necesita para cobrar. */
export const GET = withAuth([UserRole.OWNER, UserRole.RECEPTIONIST], async (req, session) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToUser(gymId, session.user.id)) {
    logger.warn("gymBelongsToUser failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(await getPaymentMethodConfigs(gymId))
})

/** Solo el dueño configura habilitación y recargo/descuento de cada medio de pago. */
export const PATCH = withAuth([UserRole.OWNER], async (req, session) => {
  const body = await req.json()
  const parsed = updatePaymentMethodConfigsSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { gymId, configs } = parsed.data

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await gymIsActive(gymId)) {
    logger.warn("Gym inactive or suspended", { gymId })
    return NextResponse.json({ error: "Gym is suspended or inactive" }, { status: 403 })
  }

  // El body puede traer solo algunos medios: la invariante "al menos uno
  // habilitado" se controla sobre el resultado final, no sobre lo enviado.
  const current = await getPaymentMethodConfigs(gymId)
  const merged = current.map((c) => configs.find((u) => u.method === c.method) ?? c)
  if (!merged.some((c) => c.enabled)) {
    logger.warn("Attempt to disable every payment method", { gymId })
    return NextResponse.json(
      { error: "Tiene que quedar al menos un medio de pago habilitado" },
      { status: 400 },
    )
  }

  const result = await updatePaymentMethodConfigs(gymId, configs)
  logger.info("Payment method configs updated", { gymId, methods: configs.map((c) => c.method) })
  return NextResponse.json(result)
})
