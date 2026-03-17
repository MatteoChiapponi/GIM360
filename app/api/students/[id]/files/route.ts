import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, studentBelongsToGym } from "@/modules/belongs/belongs.service"
import { getFilesByStudent, createStudentFile } from "@/modules/students/files/student-files.service"
import { uploadFileSchema, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/modules/students/files/student-files.schema"
import { supabaseAdmin, STUDENT_FILES_BUCKET } from "@/lib/supabase-admin"

type Params = { id: string }

export const GET = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await studentBelongsToGym(id, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const files = await getFilesByStudent(id)

  const filesWithUrls = await Promise.all(
    files.map(async (file) => {
      const { data } = await supabaseAdmin.storage
        .from(STUDENT_FILES_BUCKET)
        .createSignedUrl(file.storagePath, 3600)
      return { ...file, signedUrl: data?.signedUrl ?? null }
    })
  )

  return NextResponse.json(filesWithUrls)
})

export const POST = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const formData = await req.formData()

  const gymId = formData.get("gymId")
  const fileType = formData.get("fileType")
  const file = formData.get("file")

  if (!(file instanceof File))
    return NextResponse.json({ error: "file required" }, { status: 400 })

  const parsed = uploadFileSchema.safeParse({ gymId, fileType })
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number]))
    return NextResponse.json({ error: "Tipo de archivo no permitido. Usar PDF, JPEG, PNG o WEBP." }, { status: 400 })

  if (file.size > MAX_FILE_SIZE_BYTES)
    return NextResponse.json({ error: "El archivo supera el límite de 10 MB." }, { status: 400 })

  if (!await gymBelongsToOwner(parsed.data.gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await studentBelongsToGym(id, parsed.data.gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
  const storagePath = `gyms/${parsed.data.gymId}/students/${id}/${parsed.data.fileType}/${Date.now()}-${safeName}`

  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await supabaseAdmin.storage
    .from(STUDENT_FILES_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type })

  if (uploadError) {
    console.error("[upload] Supabase error:", uploadError)
    return NextResponse.json({ error: "Error al subir el archivo." }, { status: 500 })
  }

  const record = await createStudentFile({
    studentId: id,
    gymId: parsed.data.gymId,
    fileType: parsed.data.fileType,
    fileName: file.name,
    storagePath,
    mimeType: file.type,
    sizeBytes: file.size,
  })

  return NextResponse.json(record, { status: 201 })
})
