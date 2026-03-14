import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, expenseBelongsToGym } from "@/modules/belongs/belongs.service"
import { updateExpense, deleteExpense } from "@/modules/expenses/expenses.service"
import { updateExpenseSchema } from "@/modules/expenses/expenses.schema"

type Params = { id: string }

export const PATCH = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await expenseBelongsToGym(id, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = updateExpenseSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  return NextResponse.json(await updateExpense(id, parsed.data))
})

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await expenseBelongsToGym(id, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await deleteExpense(id)
  return new NextResponse(null, { status: 204 })
})
