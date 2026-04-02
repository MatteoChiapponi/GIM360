import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, studentBelongsToGym } from "@/modules/belongs/belongs.service"
import { getStudentFileById, deleteStudentFile } from "@/modules/students/files/student-files.service"
import { supabaseAdmin, STUDENT_FILES_BUCKET } from "@/lib/supabase-admin"
import { logger } from "@/lib/logger"

type Params = { id: string; fileId: string }

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id, fileId }) => {
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

  const file = await getStudentFileById(fileId)
  if (!file) {
    logger.warn("Student file not found", { id: fileId })
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (file.studentId !== id) {
    logger.warn("Student file does not belong to student", { fileId, studentId: id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await supabaseAdmin.storage.from(STUDENT_FILES_BUCKET).remove([file.storagePath])
  await deleteStudentFile(fileId)

  logger.info("Student file deleted", { id: fileId, studentId: id })
  return new NextResponse(null, { status: 204 })
})
