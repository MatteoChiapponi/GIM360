import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym, studentBelongsToGym } from "@/modules/belongs/belongs.service"
import { enrollStudent } from "@/modules/groups/groups.service"

type Params = { id: string }

const enrollSchema = z.object({ studentId: z.string().min(1) })

export const POST = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id: groupId }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await groupBelongsToGym(groupId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = enrollSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!await studentBelongsToGym(parsed.data.studentId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await enrollStudent(groupId, parsed.data.studentId), { status: 201 })
})
