import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym, studentBelongsToGroup } from "@/modules/belongs/belongs.service"
import { unenrollStudent } from "@/modules/groups/groups.service"

type Params = { id: string; studentId: string }

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id: groupId, studentId }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await groupBelongsToGym(groupId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await studentBelongsToGroup(studentId, groupId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await unenrollStudent(groupId, studentId)
  return new NextResponse(null, { status: 204 })
})
