import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, studentBelongsToGym } from "@/modules/belongs/belongs.service"
import { getStudentById, updateStudent, deactivateStudent } from "@/modules/students/students.service"
import { updateStudentSchema } from "@/modules/students/students.schema"
import { logger } from "@/lib/logger"

type Params = { id: string }

export const GET = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await studentBelongsToGym(id, gymId)) {
    logger.warn("studentBelongsToGym failed", { studentId: id, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const student = await getStudentById(id)
  if (!student) {
    logger.warn("Student not found", { id })
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  return NextResponse.json(student)
})

export const PATCH = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await studentBelongsToGym(id, gymId)) {
    logger.warn("studentBelongsToGym failed", { studentId: id, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateStudentSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const result = await updateStudent(id, parsed.data)
  logger.info("Student updated", { id })
  return NextResponse.json(result)
})

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) {
    logger.warn("Missing required param: gymId")
    return NextResponse.json({ error: "gymId required" }, { status: 400 })
  }

  if (!await gymBelongsToOwner(gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!await studentBelongsToGym(id, gymId)) {
    logger.warn("studentBelongsToGym failed", { studentId: id, gymId })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Soft delete: set leftAt
  const result = await deactivateStudent(id)
  logger.info("Student deleted", { id })
  return NextResponse.json(result)
})
