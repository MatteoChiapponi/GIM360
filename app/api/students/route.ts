import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToUser } from "@/modules/belongs/belongs.service"
import { getStudentsByGym, createStudent } from "@/modules/students/students.service"
import { createStudentSchema } from "@/modules/students/students.schema"
import { logger } from "@/lib/logger"

export const GET = withAuth([UserRole.OWNER, UserRole.RECEPTIONIST], async (req, session) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToUser(gymId, session.user.id)) {
    logger.warn("gymBelongsToUser failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json(await getStudentsByGym(gymId))
})

export const POST = withAuth([UserRole.OWNER, UserRole.RECEPTIONIST], async (req, session) => {
  const body = await req.json()
  const parsed = createStudentSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!await gymBelongsToUser(parsed.data.gymId, session.user.id)) {
    logger.warn("gymBelongsToUser failed", { gymId: parsed.data.gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const result = await createStudent(parsed.data)
  logger.info("Student created", { id: result.id })
  return NextResponse.json(result, { status: 201 })
})
