import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner, gymIsActive } from "@/modules/belongs/belongs.service"
import { generateMonthlyPayments, getPaymentsByGym } from "@/modules/payments/payments.service"
import { generatePaymentsSchema } from "@/modules/payments/payments.schema"

export const GET = withAuth([UserRole.OWNER, UserRole.RECEPTIONIST], async (req, session) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  const period = req.nextUrl.searchParams.get("period")
  if (!gymId || !period)
    return NextResponse.json({ error: "gymId and period required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await gymIsActive(gymId))
    return NextResponse.json({ error: "Gym is suspended or inactive" }, { status: 403 })

  return NextResponse.json(await getPaymentsByGym(gymId, period))
})

export const POST = withAuth([UserRole.OWNER, UserRole.RECEPTIONIST], async (req, session) => {
  const body = await req.json()
  const parsed = generatePaymentsSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { gymId, period } = parsed.data

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await gymIsActive(gymId))
    return NextResponse.json({ error: "Gym is suspended or inactive" }, { status: 403 })

  return NextResponse.json(await generateMonthlyPayments(gymId, period), { status: 201 })
})
