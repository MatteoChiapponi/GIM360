import { db } from "@/lib/db"
import type { StudentFileType } from "@/app/generated/prisma/client"

export type CreateStudentFileInput = {
  studentId: string
  gymId: string
  fileType: StudentFileType
  fileName: string
  storagePath: string
  mimeType: string
  sizeBytes: number
}

export async function getFilesByStudent(studentId: string) {
  return db.studentFile.findMany({
    where: { studentId },
    orderBy: { uploadedAt: "desc" },
  })
}

export async function createStudentFile(data: CreateStudentFileInput) {
  return db.studentFile.create({ data })
}

export async function getStudentFileById(fileId: string) {
  return db.studentFile.findUnique({ where: { id: fileId } })
}

export async function deleteStudentFile(fileId: string) {
  return db.studentFile.delete({ where: { id: fileId } })
}
