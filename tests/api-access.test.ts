import { describe, it, expect, beforeEach, vi } from "vitest"

// El fake de Prisma queda vivo: los `belongs` corren de verdad contra el
// fixture, así que estos tests cubren rol → belongs → handler de punta a punta.
vi.mock("@/lib/db", () => import("./mocks/db"))

// La sesión y los servicios de dominio sí se mockean: no son lo que se prueba acá.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock("@/lib/supabase-admin", () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: { signedUrl: "https://signed" }, error: null }),
        upload: async () => ({ error: null }),
        remove: async () => ({ error: null }),
      }),
    },
  },
  STUDENT_FILES_BUCKET: "student-files",
}))

vi.mock("@/modules/students/students.service", () => ({
  getStudentsByGym: vi.fn(async () => []),
  getStudentById: vi.fn(async () => ({ id: "s" })),
  createStudent: vi.fn(async () => ({ id: "s" })),
  updateStudent: vi.fn(async () => ({ id: "s" })),
  deactivateStudent: vi.fn(async () => ({ id: "s" })),
}))

vi.mock("@/modules/students/files/student-files.service", () => ({
  getFilesByStudent: vi.fn(async () => []),
  getStudentFileById: vi.fn(async () => ({ id: "f", studentId: "cstudent0000000000000001", storagePath: "p" })),
  createStudentFile: vi.fn(async () => ({ id: "f" })),
  deleteStudentFile: vi.fn(async () => undefined),
}))

vi.mock("@/modules/payments/payments.service", () => ({
  getPaymentsByGym: vi.fn(async () => []),
  getPaymentsByStudent: vi.fn(async () => []),
  generateMonthlyPayments: vi.fn(async () => []),
  updatePayment: vi.fn(async () => ({ id: "p" })),
  deletePayment: vi.fn(async () => undefined),
}))

vi.mock("@/modules/attendance/attendance.service", () => ({
  ensureAttendanceUpToDate: vi.fn(async () => []),
  getAttendanceByGymDate: vi.fn(async () => []),
  getAttendanceByGymDateRange: vi.fn(async () => []),
  getTrainerAttendanceForDate: vi.fn(async () => []),
  getTrainerAttendanceForDateRange: vi.fn(async () => []),
  getAttendanceById: vi.fn(async () => ({
    id: "cattend00000000000000001",
    gymId: "cgym10000000000000000001",
    groupId: "cgroup000000000000000001",
  })),
  getGroupStudentsForAttendance: vi.fn(async () => []),
  submitAttendance: vi.fn(async () => ({ id: "a" })),
}))

vi.mock("@/modules/groups/groups.service", () => ({
  getGroupsByGym: vi.fn(async () => []),
  createGroup: vi.fn(async () => ({ id: "g" })),
  enrollStudent: vi.fn(async () => ({ id: "sg" })),
}))

vi.mock("@/modules/gyms/gyms.service", () => ({
  getGymsByOwner: vi.fn(async () => []),
  getGymById: vi.fn(async (id: string) => ({ id, name: "Gym", createdAt: new Date().toISOString() })),
  getOwnerByUserId: vi.fn(async () => ({ name: "Owner" })),
  createGym: vi.fn(async () => ({ id: "gym" })),
  updateGym: vi.fn(async () => ({ id: "gym" })),
  deleteGym: vi.fn(async () => undefined),
}))

vi.mock("@/modules/trainers/trainers.service", () => ({
  getTrainerByUserId: vi.fn(async () => ({ id: "trainer-1", gymId: "cgym10000000000000000001", name: "Laura" })),
  getTrainerProfileByUserId: vi.fn(async () => ({ id: "trainer-1" })),
  getTrainersByGym: vi.fn(async () => []),
  getTrainerById: vi.fn(async () => ({ id: "trainer-1" })),
  createTrainer: vi.fn(async () => ({ id: "trainer-1" })),
  updateTrainer: vi.fn(async () => ({ id: "trainer-1" })),
  deleteTrainer: vi.fn(async () => undefined),
  assignUserToTrainer: vi.fn(async () => ({ email: "t@t.com" })),
  revokeUserFromTrainer: vi.fn(async () => undefined),
  getTrainerScheduleConflicts: vi.fn(async () => []),
}))

vi.mock("@/modules/receptionists/receptionists.service", () => ({
  getReceptionistByUserId: vi.fn(async () => ({
    id: "crecep00000000000000001",
    gymId: "cgym10000000000000000001",
    name: "Sofia",
    active: true,
    gym: { id: "cgym10000000000000000001", name: "Gym", status: "ACTIVE" },
  })),
  getReceptionistsByGym: vi.fn(async () => []),
  getReceptionistById: vi.fn(async () => ({ id: "crecep00000000000000001" })),
  createReceptionistWithUser: vi.fn(async () => ({ id: "crecep00000000000000001" })),
  updateReceptionist: vi.fn(async () => ({ id: "crecep00000000000000001" })),
  resetReceptionistPassword: vi.fn(async () => undefined),
  deleteReceptionist: vi.fn(async () => undefined),
}))

import { auth } from "@/lib/auth"
import { IDS, SESSIONS, makeRequest, seedTwoGyms, withParams } from "./helpers"

const mockAuth = vi.mocked(auth)

beforeEach(() => {
  seedTwoGyms()
})

function loginAs(session: ReturnType<typeof SESSIONS.owner1> | null) {
  mockAuth.mockResolvedValue(session as never)
}

const G1 = IDS.gym1
const G2 = IDS.gym2

// ─── Catálogo de endpoints ───────────────────────────────────────────────────
//
// Cada entrada invoca el handler real. `gymId` parametriza el gimnasio para
// poder repetir el mismo caso contra el gimnasio ajeno.

type Endpoint = {
  name: string
  call: (gymId: string) => Promise<Response>
  /** false para endpoints que tampoco son del owner (área de trainer o de admin). */
  ownerAllowed?: boolean
}

const RECEPTIONIST_ALLOWED: Endpoint[] = [
  {
    name: "GET /api/students",
    call: async (gymId) => (await import("@/app/api/students/route")).GET(makeRequest(`/api/students?gymId=${gymId}`)),
  },
  {
    name: "POST /api/students",
    call: async (gymId) =>
      (await import("@/app/api/students/route")).POST(
        makeRequest("/api/students", {
          method: "POST",
          body: { gymId, firstName: "Ana", lastName: "Gomez", phone1: "11 1234-5678" },
        }),
      ),
  },
  {
    name: "GET /api/students/[id]",
    call: async (gymId) =>
      (await import("@/app/api/students/[id]/route")).GET(
        makeRequest(`/api/students/${IDS.student1}?gymId=${gymId}`),
        withParams({ id: IDS.student1 }),
      ),
  },
  {
    name: "PATCH /api/students/[id]",
    call: async (gymId) =>
      (await import("@/app/api/students/[id]/route")).PATCH(
        makeRequest(`/api/students/${IDS.student1}?gymId=${gymId}`, { method: "PATCH", body: { firstName: "Ana" } }),
        withParams({ id: IDS.student1 }),
      ),
  },
  {
    name: "DELETE /api/students/[id]",
    call: async (gymId) =>
      (await import("@/app/api/students/[id]/route")).DELETE(
        makeRequest(`/api/students/${IDS.student1}?gymId=${gymId}`, { method: "DELETE" }),
        withParams({ id: IDS.student1 }),
      ),
  },
  {
    name: "GET /api/students/[id]/files",
    call: async (gymId) =>
      (await import("@/app/api/students/[id]/files/route")).GET(
        makeRequest(`/api/students/${IDS.student1}/files?gymId=${gymId}`),
        withParams({ id: IDS.student1 }),
      ),
  },
  {
    name: "GET /api/payments",
    call: async (gymId) =>
      (await import("@/app/api/payments/route")).GET(makeRequest(`/api/payments?gymId=${gymId}&period=2026-03`)),
  },
  {
    name: "POST /api/payments (generar cuotas del mes)",
    call: async (gymId) =>
      (await import("@/app/api/payments/route")).POST(
        makeRequest("/api/payments", { method: "POST", body: { gymId, period: "2026-03" } }),
      ),
  },
  {
    name: "PATCH /api/payments/[id] (registrar pago)",
    call: async (gymId) =>
      (await import("@/app/api/payments/[id]/route")).PATCH(
        makeRequest(`/api/payments/${IDS.payment1}?gymId=${gymId}`, {
          method: "PATCH",
          body: { status: "PAID", paymentMethod: "CASH" },
        }),
        withParams({ id: IDS.payment1 }),
      ),
  },
  {
    name: "GET /api/attendance",
    call: async (gymId) =>
      (await import("@/app/api/attendance/route")).GET(
        makeRequest(`/api/attendance?gymId=${gymId}&date=2026-03-10`),
      ),
  },
  {
    name: "POST /api/attendance",
    call: async (gymId) =>
      (await import("@/app/api/attendance/route")).POST(
        makeRequest("/api/attendance", { method: "POST", body: { gymId, date: "2026-03-10" } }),
      ),
  },
  {
    name: "GET /api/groups",
    call: async (gymId) => (await import("@/app/api/groups/route")).GET(makeRequest(`/api/groups?gymId=${gymId}`)),
  },
  {
    name: "POST /api/groups/[id]/students (inscribir)",
    call: async (gymId) =>
      (await import("@/app/api/groups/[id]/students/route")).POST(
        makeRequest(`/api/groups/${IDS.group1}/students?gymId=${gymId}`, {
          method: "POST",
          body: { studentId: IDS.student1 },
        }),
        withParams({ id: IDS.group1 }),
      ),
  },
  {
    name: "GET /api/gyms/[id]",
    call: async (gymId) =>
      (await import("@/app/api/gyms/[id]/route")).GET(makeRequest(`/api/gyms/${gymId}`), withParams({ id: gymId })),
  },
  {
    name: "GET /api/payment-methods",
    call: async (gymId) =>
      (await import("@/app/api/payment-methods/route")).GET(makeRequest(`/api/payment-methods?gymId=${gymId}`)),
  },
  {
    name: "GET /api/late-fee",
    call: async (gymId) =>
      (await import("@/app/api/late-fee/route")).GET(makeRequest(`/api/late-fee?gymId=${gymId}`)),
  },
]

const RECEPTIONIST_DENIED: Endpoint[] = [
  {
    name: "POST /api/groups",
    call: async (gymId) =>
      (await import("@/app/api/groups/route")).POST(
        makeRequest("/api/groups", { method: "POST", body: { gymId, name: "G", monthlyPrice: 1000 } }),
      ),
  },
  {
    name: "GET /api/trainers",
    call: async (gymId) => (await import("@/app/api/trainers/route")).GET(makeRequest(`/api/trainers?gymId=${gymId}`)),
  },
  {
    name: "GET /api/expenses",
    call: async (gymId) => (await import("@/app/api/expenses/route")).GET(makeRequest(`/api/expenses?gymId=${gymId}`)),
  },
  {
    name: "GET /api/metrics/gym",
    call: async (gymId) =>
      (await import("@/app/api/metrics/gym/route")).GET(makeRequest(`/api/metrics/gym?gymId=${gymId}`)),
  },
  {
    name: "GET /api/metrics/groups",
    call: async (gymId) =>
      (await import("@/app/api/metrics/groups/route")).GET(makeRequest(`/api/metrics/groups?gymId=${gymId}`)),
  },
  {
    name: "GET /api/cash-closings",
    call: async (gymId) =>
      (await import("@/app/api/cash-closings/route")).GET(makeRequest(`/api/cash-closings?gymId=${gymId}`)),
  },
  {
    name: "POST /api/cash-closings",
    call: async (gymId) =>
      (await import("@/app/api/cash-closings/route")).POST(
        makeRequest("/api/cash-closings", { method: "POST", body: { gymId } }),
      ),
  },
  {
    name: "DELETE /api/payments/[id]",
    call: async (gymId) =>
      (await import("@/app/api/payments/[id]/route")).DELETE(
        makeRequest(`/api/payments/${IDS.payment1}?gymId=${gymId}`, { method: "DELETE" }),
        withParams({ id: IDS.payment1 }),
      ),
  },
  {
    name: "PATCH /api/gyms/[id]",
    call: async (gymId) =>
      (await import("@/app/api/gyms/[id]/route")).PATCH(
        makeRequest(`/api/gyms/${gymId}`, { method: "PATCH", body: { name: "Nuevo" } }),
        withParams({ id: gymId }),
      ),
  },
  {
    name: "GET /api/receptionists",
    call: async (gymId) =>
      (await import("@/app/api/receptionists/route")).GET(makeRequest(`/api/receptionists?gymId=${gymId}`)),
  },
  {
    name: "POST /api/receptionists",
    call: async (gymId) =>
      (await import("@/app/api/receptionists/route")).POST(
        makeRequest("/api/receptionists", {
          method: "POST",
          body: { gymId, name: "X", email: "x@x.com", password: "12345678" },
        }),
      ),
  },
  {
    name: "DELETE /api/receptionists/[id]",
    call: async (gymId) =>
      (await import("@/app/api/receptionists/[id]/route")).DELETE(
        makeRequest(`/api/receptionists/${IDS.receptionist1}?gymId=${gymId}`, { method: "DELETE" }),
        withParams({ id: IDS.receptionist1 }),
      ),
  },
  {
    name: "POST /api/receptionists/[id]/password",
    call: async (gymId) =>
      (await import("@/app/api/receptionists/[id]/password/route")).POST(
        makeRequest(`/api/receptionists/${IDS.receptionist1}/password?gymId=${gymId}`, {
          method: "POST",
          body: { password: "12345678" },
        }),
        withParams({ id: IDS.receptionist1 }),
      ),
  },
  {
    name: "GET /api/trainers/me",
    ownerAllowed: false,
    call: async () => (await import("@/app/api/trainers/me/route")).GET(makeRequest("/api/trainers/me")),
  },
  {
    name: "GET /api/admin/owners",
    ownerAllowed: false,
    call: async () => (await import("@/app/api/admin/owners/route")).GET(makeRequest("/api/admin/owners")),
  },
  {
    name: "PATCH /api/late-fee (configurar el recargo por mora)",
    call: async (gymId) =>
      (await import("@/app/api/late-fee/route")).PATCH(
        makeRequest("/api/late-fee", {
          method: "PATCH",
          body: {
            gymId,
            enabled: true,
            graceDays: 5,
            feeType: "PERCENT",
            feeValue: 10,
            repeatEveryDays: 7,
            maxCharges: 4,
            maxFeeAmount: null,
          },
        }),
      ),
  },
  {
    name: "PATCH /api/payment-methods (configurar medios de pago)",
    call: async (gymId) =>
      (await import("@/app/api/payment-methods/route")).PATCH(
        makeRequest("/api/payment-methods", {
          method: "PATCH",
          body: {
            gymId,
            configs: [{ method: "CARD", enabled: true, adjustmentType: "SURCHARGE", adjustmentPercent: 10 }],
          },
        }),
      ),
  },
  {
    name: "POST /api/schedules",
    call: async () =>
      (await import("@/app/api/schedules/route")).POST(
        makeRequest("/api/schedules", {
          method: "POST",
          body: { groupId: IDS.group1, weekDays: ["MONDAY"], startTime: "10:00", endTime: "11:00", startDate: new Date().toISOString() },
        }),
      ),
  },
]

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("El recepcionista accede a alumnos, cuotas y asistencias de SU gimnasio", () => {
  it.each(RECEPTIONIST_ALLOWED)("$name → no lo rechaza", async ({ call }) => {
    loginAs(SESSIONS.receptionist1())
    const res = await call(G1)
    expect([401, 403]).not.toContain(res.status)
  })
})

describe("El recepcionista NO accede a lo que es del owner", () => {
  it.each(RECEPTIONIST_DENIED)("$name → 403", async ({ call }) => {
    loginAs(SESSIONS.receptionist1())
    const res = await call(G1)
    expect(res.status).toBe(403)
  })
})

describe("Aislamiento entre gimnasios", () => {
  it.each(RECEPTIONIST_ALLOWED)("$name contra el gimnasio ajeno → 403", async ({ call }) => {
    loginAs(SESSIONS.receptionist1())
    const res = await call(G2)
    expect(res.status).toBe(403)
  })

  it("el owner tampoco alcanza el gimnasio del otro owner", async () => {
    loginAs(SESSIONS.owner2())
    const { GET } = await import("@/app/api/students/route")
    const res = await GET(makeRequest(`/api/students?gymId=${G1}`))
    expect(res.status).toBe(403)
  })
})

describe("Un recepcionista desactivado pierde el acceso", () => {
  it.each(RECEPTIONIST_ALLOWED)("$name → 403", async ({ call }) => {
    loginAs(SESSIONS.receptionistInactive())
    const res = await call(G1)
    expect(res.status).toBe(403)
  })
})

describe("Sin sesión no se entra a ningún lado", () => {
  it.each([...RECEPTIONIST_ALLOWED, ...RECEPTIONIST_DENIED])("$name → 401", async ({ call }) => {
    loginAs(null)
    const res = await call(G1)
    expect(res.status).toBe(401)
  })
})

describe("El owner conserva el acceso completo a su gimnasio", () => {
  const OWNER_ENDPOINTS = [...RECEPTIONIST_ALLOWED, ...RECEPTIONIST_DENIED].filter(
    (e) => e.ownerAllowed !== false,
  )

  it.each(OWNER_ENDPOINTS)("$name → no lo rechaza", async ({ call }) => {
    loginAs(SESSIONS.owner1())
    const res = await call(G1)
    expect([401, 403]).not.toContain(res.status)
  })

  it("los endpoints de trainer y admin siguen fuera de su alcance", async () => {
    loginAs(SESSIONS.owner1())
    for (const { call } of RECEPTIONIST_DENIED.filter((e) => e.ownerAllowed === false)) {
      expect((await call(G1)).status).toBe(403)
    }
  })
})

describe("El trainer no entra por la puerta del recepcionista", () => {
  const TRAINER_FORBIDDEN = RECEPTIONIST_ALLOWED.filter(
    // El trainer sí tiene acceso propio a asistencias y al listado de gimnasios.
    (e) => !e.name.includes("attendance") && !e.name.includes("gyms"),
  )

  it.each(TRAINER_FORBIDDEN)("$name → 403", async ({ call }) => {
    loginAs(SESSIONS.trainer1())
    const res = await call(G1)
    expect(res.status).toBe(403)
  })
})
