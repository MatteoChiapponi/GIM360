import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { createCashClosing, getCashClosingsByGym, undoLastCashClosing } from "@/modules/cash-closings/cash-closings.service"
import { createCashClosingSchema } from "@/modules/cash-closings/cash-closings.schema"
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

  return NextResponse.json(await getCashClosingsByGym(gymId))
})

export const DELETE = withAuth([UserRole.OWNER], async (req, session) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const closing = await undoLastCashClosing(gymId)
    logger.info("Cash closing undone", { id: closing.id, gymId })
    return NextResponse.json(closing)
  } catch (e: unknown) {
    logger.error("undoLastCashClosing failed", { error: String(e), gymId })
    const message = e instanceof Error ? e.message : "Error al deshacer el cierre"
    return NextResponse.json({ error: message }, { status: 404 })
  }
})

export const POST = withAuth([UserRole.OWNER], async (req, session) => {
  const body = await req.json()
  const parsed = createCashClosingSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!await gymBelongsToOwner(parsed.data.gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId: parsed.data.gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const closing = await createCashClosing(parsed.data)
    logger.info("Cash closing created", { id: closing.id })
    return NextResponse.json(closing, { status: 201 })
  } catch (e: unknown) {
    logger.error("createCashClosing failed", { error: String(e), gymId: parsed.data.gymId })
    const message = e instanceof Error ? e.message : "Error al crear el cierre de caja"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})
