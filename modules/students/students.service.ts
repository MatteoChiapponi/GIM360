import { db } from "@/lib/db"
import type { CreateStudentInput, UpdateStudentInput } from "./students.schema"

export async function getStudentsByGym(gymId: string) {
  return db.student.findMany({
    where: { gymId },
    orderBy: { lastName: "asc" },
    include: {
      files: { select: { fileType: true } },
    },
  })
}

export async function getStudentById(id: string) {
  return db.student.findFirst({
    where: { id },
    include: {
      groups: {
        include: {
          group: {
            include: { schedules: true },
          },
        },
        orderBy: { enrolledAt: "asc" },
      },
    },
  })
}

export async function createStudent(data: CreateStudentInput) {
  return db.student.create({
    data: {
      ...data,
      birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
    },
  })
}

export async function updateStudent(id: string, data: UpdateStudentInput) {
  return db.student.update({
    where: { id },
    data: {
      ...data,
      birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
    },
  })
}

export async function deactivateStudent(id: string) {
  return db.student.update({ where: { id }, data: { leftAt: new Date() } })
}

export async function deleteStudent(id: string) {
  return db.student.delete({ where: { id } })
}
