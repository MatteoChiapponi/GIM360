import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, studentBelongsToGym } from "@/modules/belongs/belongs.service"
import { getStudentFileById, deleteStudentFile } from "@/modules/students/files/student-files.service"
import { supabaseAdmin, STUDENT_FILES_BUCKET } from "@/lib/supabase-admin"

type Params = { id: string; fileId: string }

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id, fileId }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await studentBelongsToGym(id, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const file = await getStudentFileById(fileId)
  if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (file.studentId !== id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await supabaseAdmin.storage.from(STUDENT_FILES_BUCKET).remove([file.storagePath])
  await deleteStudentFile(fileId)

  return new NextResponse(null, { status: 204 })
})
