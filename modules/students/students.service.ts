import { db } from "@/lib/db"
import type { CreateStudentInput, UpdateStudentInput } from "./students.schema"

export async function getStudentsByGym(gymId: string) {
  return db.student.findMany({
    where: { gymId },
    orderBy: { apellido: "asc" },
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
      fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : undefined,
      vencimientoApto: data.vencimientoApto ? new Date(data.vencimientoApto) : undefined,
    },
  })
}

export async function updateStudent(id: string, data: UpdateStudentInput) {
  return db.student.update({
    where: { id },
    data: {
      ...data,
      fechaNacimiento: data.fechaNacimiento ? new Date(data.fechaNacimiento) : undefined,
      vencimientoApto: data.vencimientoApto ? new Date(data.vencimientoApto) : undefined,
    },
  })
}

export async function deleteStudent(id: string) {
  return db.student.delete({ where: { id } })
}
