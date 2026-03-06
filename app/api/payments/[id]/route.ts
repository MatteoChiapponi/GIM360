import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { paymentBelongsToGym, gymIsActive } from "@/modules/belongs/belongs.service"
import { updatePayment, deletePayment } from "@/modules/payments/payments.service"
import { updatePaymentSchema } from "@/modules/payments/payments.schema"

type Params = { id: string }

export const PATCH = withAuthParams<Params>([UserRole.OWNER, UserRole.RECEPTIONIST], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId)
    return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await paymentBelongsToGym(id, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await gymIsActive(gymId))
    return NextResponse.json({ error: "Gym is suspended or inactive" }, { status: 403 })

  const body = await req.json()
  const parsed = updatePaymentSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  return NextResponse.json(await updatePayment(id, parsed.data))
})

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId)
    return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await paymentBelongsToGym(id, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await gymIsActive(gymId))
    return NextResponse.json({ error: "Gym is suspended or inactive" }, { status: 403 })

  await deletePayment(id)
  return new NextResponse(null, { status: 204 })
})
