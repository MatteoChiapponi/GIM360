import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { paymentBelongsToGym } from "@/modules/belongs/belongs.service"
import { updatePayment, deletePayment } from "@/modules/payments/payments.service"
import { updatePaymentSchema } from "@/modules/payments/payments.schema"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (
    session.user.role === "OWNER" &&
    !await paymentBelongsToGym(id, gymId)
  ) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = updatePaymentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  return NextResponse.json(await updatePayment(id, parsed.data))
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (
    session.user.role === "OWNER" &&
    !await paymentBelongsToGym(id, gymId)
  ) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await deletePayment(id)
  return new NextResponse(null, { status: 204 })
}
