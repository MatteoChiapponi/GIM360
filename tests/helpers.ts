import { NextRequest } from "next/server"
import type { Session } from "next-auth"
import type { UserRole } from "@/app/generated/prisma/client"
import { seed } from "./mocks/db"

// ─── Fixture compartido ──────────────────────────────────────────────────────
//
// Dos gimnasios de dueños distintos. Todo test de aislamiento multi-tenant se
// apoya en que G2 nunca es alcanzable desde una sesión de G1.

// Con forma de cuid: varios schemas Zod validan `.cuid()`, así que un id con
// guiones haría fallar la validación (400) antes de llegar al chequeo de acceso
// y taparía lo que estos tests quieren medir.
export const IDS = {
  gym1: "cgym10000000000000000001",
  gym2: "cgym20000000000000000002",
  ownerUser1: "cusrowner000000000000001",
  ownerUser2: "cusrowner000000000000002",
  receptionistUser1: "cusrrecep000000000000001",
  receptionistUser2: "cusrrecep000000000000002",
  receptionistUserInactive: "cusrrecep000000000000003",
  trainerUser1: "cusrtrainer00000000000001",
  adminUser: "cusradmin000000000000001",
  receptionist1: "crecep00000000000000001",
  receptionist2: "crecep00000000000000002",
  receptionistInactive: "crecep00000000000000003",
  student1: "cstudent0000000000000001",
  student2: "cstudent0000000000000002",
  group1: "cgroup000000000000000001",
  payment1: "cpayment0000000000000001",
  attendance1: "cattend00000000000000001",
  discount1: "cdiscount000000000000001",
  discount2: "cdiscount000000000000002",
  assignment1: "cassign00000000000000001",
} as const

/**
 * Carga el escenario base:
 *  - gym1 (ACTIVE) de owner1, con recepcionista activo, uno desactivado y un trainer
 *  - gym2 (ACTIVE) de owner2, con su propio recepcionista
 *  - un descuento por gimnasio, el de gym1 asignado a student1
 */
export function seedTwoGyms() {
  seed("gym", [
    { id: IDS.gym1, status: "ACTIVE", owner: { userId: IDS.ownerUser1 } },
    { id: IDS.gym2, status: "ACTIVE", owner: { userId: IDS.ownerUser2 } },
  ])

  seed("receptionist", [
    { id: IDS.receptionist1, gymId: IDS.gym1, userId: IDS.receptionistUser1, name: "Sofia", active: true },
    { id: IDS.receptionist2, gymId: IDS.gym2, userId: IDS.receptionistUser2, name: "Marta", active: true },
    {
      id: IDS.receptionistInactive,
      gymId: IDS.gym1,
      userId: IDS.receptionistUserInactive,
      name: "Ex Recepcion",
      active: false,
    },
  ])

  seed("trainer", [{ id: "trainer-1", gymId: IDS.gym1, userId: IDS.trainerUser1, name: "Laura", active: true }])

  seed("student", [
    { id: IDS.student1, gymId: IDS.gym1 },
    { id: IDS.student2, gymId: IDS.gym2 },
  ])

  seed("group", [{ id: IDS.group1, gymId: IDS.gym1 }])
  seed("payment", [paymentRow()])
  seed("attendance", [{ id: IDS.attendance1, gymId: IDS.gym1, groupId: IDS.group1 }])

  seed("discount", [
    { id: IDS.discount1, gymId: IDS.gym1, name: "Hermanos", type: "PERCENTAGE", value: 20, active: true },
    { id: IDS.discount2, gymId: IDS.gym2, name: "Beca", type: "FIXED_PRICE", value: 10000, active: true },
  ])

  seed("studentDiscount", [
    {
      id: IDS.assignment1,
      studentId: IDS.student1,
      discountId: IDS.discount1,
      validFrom: new Date(Date.UTC(2026, 0, 1)),
      validUntil: null,
    },
  ])
}

/** Período del pago del fixture y día de vencimiento del alumno. */
export const PAYMENT_FIXTURE = {
  period: new Date(Date.UTC(2026, 7, 1)),
  periodKey: "2026-08",
  dueDay: 10,
} as const

/**
 * Fila de pago con forma completa: el fake de Prisma no resuelve `include`, así
 * que el alumno viaja embebido igual que lo devolvería la query real.
 */
export function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: IDS.payment1,
    gymId: IDS.gym1,
    studentId: IDS.student1,
    period: PAYMENT_FIXTURE.period,
    verified: false,
    status: "PENDING",
    amount: "10000",
    listAmount: 30000,
    baseAmount: null,
    methodAdjustment: null,
    lateFee: null,
    lateDays: null,
    lateFeeWaived: false,
    manualAdjustment: null,
    manualAdjustmentReason: null,
    paymentMethod: null,
    paidAt: null,
    student: { dueDay: PAYMENT_FIXTURE.dueDay, lateFeeExempt: false },
    ...overrides,
  }
}

// ─── Sesiones ────────────────────────────────────────────────────────────────

export function sessionFor(role: UserRole, userId: string): Session {
  return {
    user: { id: userId, role, email: `${userId}@test.com` },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  } as Session
}

export const SESSIONS = {
  owner1: () => sessionFor("OWNER", IDS.ownerUser1),
  owner2: () => sessionFor("OWNER", IDS.ownerUser2),
  receptionist1: () => sessionFor("RECEPTIONIST", IDS.receptionistUser1),
  receptionist2: () => sessionFor("RECEPTIONIST", IDS.receptionistUser2),
  receptionistInactive: () => sessionFor("RECEPTIONIST", IDS.receptionistUserInactive),
  trainer1: () => sessionFor("TRAINER", IDS.trainerUser1),
  admin: () => sessionFor("ADMIN", IDS.adminUser),
}

// ─── Requests ────────────────────────────────────────────────────────────────

export function makeRequest(
  url: string,
  init: { method?: string; body?: unknown } = {},
): NextRequest {
  const { method = "GET", body } = init
  return new NextRequest(`http://localhost:3000${url}`, {
    method,
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
  })
}

/** Invoca un handler de ruta dinámica, que recibe `{ params: Promise<P> }`. */
export function withParams<P>(params: P) {
  return { params: Promise.resolve(params) }
}
