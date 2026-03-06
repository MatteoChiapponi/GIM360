import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { generateMonthlyPayments, getPaymentsByGym } from "@/modules/payments/payments.service"
import { generatePaymentsSchema } from "@/modules/payments/payments.schema"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const gymId = req.nextUrl.searchParams.get("gymId")
  const period = req.nextUrl.searchParams.get("period")
  if (!gymId || !period) return NextResponse.json({ error: "gymId and period required" }, { status: 400 })

  if (
    session.user.role === "OWNER" &&
    !await gymBelongsToOwner(gymId, session.user.id)
  ) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await getPaymentsByGym(gymId, period))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = generatePaymentsSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { gymId, period } = parsed.data

  if (
    session.user.role === "OWNER" &&
    !await gymBelongsToOwner(gymId, session.user.id)
  ) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await generateMonthlyPayments(gymId, period), { status: 201 })
}
