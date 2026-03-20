import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { cashClosingBelongsToGym } from "@/modules/belongs/belongs.service"
import { getCashClosingById } from "@/modules/cash-closings/cash-closings.service"

type Params = { id: string }

export const GET = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId)
    return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await cashClosingBelongsToGym(id, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const closing = await getCashClosingById(id)
  if (!closing)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(closing)
})
