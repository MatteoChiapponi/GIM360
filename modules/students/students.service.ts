import { db } from "@/lib/db"
import type { CreateStudentInput, UpdateStudentInput } from "./students.schema"

export async function getStudentsByGym(gymId: string) {
  return db.student.findMany({
    where: { gymId },
    orderBy: { lastName: "asc" },
  })
}

export async function getStudentById(id: string) {
  return db.student.findFirst({
    where: { id },
    include: { groups: { include: { group: true } } },
  })
}

export async function createStudent(data: CreateStudentInput) {
  return db.student.create({
    data: {
      ...data,
      birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
      medicalClearanceExpiry: data.medicalClearanceExpiry ? new Date(data.medicalClearanceExpiry) : undefined,
    },
  })
}

export async function updateStudent(id: string, data: UpdateStudentInput) {
  return db.student.update({
    where: { id },
    data: {
      ...data,
      birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
      medicalClearanceExpiry: data.medicalClearanceExpiry ? new Date(data.medicalClearanceExpiry) : undefined,
    },
  })
}

export async function deleteStudent(id: string) {
  return db.student.delete({ where: { id } })
}
