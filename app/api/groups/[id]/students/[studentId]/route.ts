import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym, studentBelongsToGroup } from "@/modules/belongs/belongs.service"
import { unenrollStudent } from "@/modules/groups/groups.service"
import { logger } from "@/lib/logger"

type Params = { id: string; studentId: string }

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id: groupId, studentId }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await groupBelongsToGym(groupId, gymId)) {
    logger.warn("groupBelongsToGym failed", { groupId, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await studentBelongsToGroup(studentId, groupId)) {
    logger.warn("studentBelongsToGroup failed", { studentId, groupId: groupId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await unenrollStudent(groupId, studentId)
  logger.info("Student unenrolled from group", { studentId, groupId })
  return new NextResponse(null, { status: 204 })
})
