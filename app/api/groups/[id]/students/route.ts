import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym, studentBelongsToGym } from "@/modules/belongs/belongs.service"
import { enrollStudent } from "@/modules/groups/groups.service"
import { logger } from "@/lib/logger"

type Params = { id: string }

const enrollSchema = z.object({ studentId: z.string().min(1) })

export const POST = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id: groupId }) => {
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

  const body = await req.json()
  const parsed = enrollSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!await studentBelongsToGym(parsed.data.studentId, gymId)) {
    logger.warn("studentBelongsToGym failed", { studentId: parsed.data.studentId, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const result = await enrollStudent(groupId, parsed.data.studentId)
  logger.info("Student enrolled in group", { studentId: parsed.data.studentId, groupId })
  return NextResponse.json(result, { status: 201 })
})
