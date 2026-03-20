import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { createCashClosing, getCashClosingsByGym } from "@/modules/cash-closings/cash-closings.service"
import { createCashClosingSchema } from "@/modules/cash-closings/cash-closings.schema"

export const GET = withAuth([UserRole.OWNER], async (req, session) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId)
    return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await getCashClosingsByGym(gymId))
})

export const POST = withAuth([UserRole.OWNER], async (req, session) => {
  const body = await req.json()
  const parsed = createCashClosingSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!await gymBelongsToOwner(parsed.data.gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const closing = await createCashClosing(parsed.data)
    return NextResponse.json(closing, { status: 201 })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al crear el cierre de caja"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})
