import { describe, it, expect, beforeEach, vi } from "vitest"

vi.mock("@/lib/db", () => import("./mocks/db"))

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}))

/** `redirect()` de Next corta la ejecución tirando; se replica para poder afirmar sobre el destino. */
class RedirectError extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`)
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new RedirectError(to)
  },
}))

import { auth } from "@/lib/auth"
import { UserRole } from "@/app/generated/prisma/client"
import { requireGymRole } from "@/lib/guards"
import { IDS, SESSIONS } from "./helpers"

const mockAuth = vi.mocked(auth)

async function redirectFrom(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (err) {
    if (err instanceof RedirectError) return err.to
    throw err
  }
}

beforeEach(() => {
  mockAuth.mockResolvedValue(null as never)
})

describe("requireGymRole", () => {
  it("manda a /login si no hay sesión", async () => {
    const to = await redirectFrom(() => requireGymRole(IDS.gym1, [UserRole.OWNER]))
    expect(to).toBe("/login")
  })

  it("deja pasar al rol permitido y devuelve la sesión", async () => {
    mockAuth.mockResolvedValue(SESSIONS.receptionist1() as never)
    const session = await requireGymRole(IDS.gym1, [UserRole.OWNER, UserRole.RECEPTIONIST])
    expect(session.user.role).toBe(UserRole.RECEPTIONIST)
  })

  it("saca al recepcionista de las secciones del owner, hacia su propia sección", async () => {
    mockAuth.mockResolvedValue(SESSIONS.receptionist1() as never)
    const to = await redirectFrom(() => requireGymRole(IDS.gym1, [UserRole.OWNER]))
    expect(to).toBe(`/${IDS.gym1}/students`)
  })

  it("manda cada otro rol a su propia entrada", async () => {
    mockAuth.mockResolvedValue(SESSIONS.trainer1() as never)
    expect(await redirectFrom(() => requireGymRole(IDS.gym1, [UserRole.OWNER]))).toBe("/trainer")

    mockAuth.mockResolvedValue(SESSIONS.admin() as never)
    expect(await redirectFrom(() => requireGymRole(IDS.gym1, [UserRole.OWNER]))).toBe("/admin")

    mockAuth.mockResolvedValue(SESSIONS.owner1() as never)
    expect(await redirectFrom(() => requireGymRole(IDS.gym1, [UserRole.RECEPTIONIST]))).toBe("/dashboard")
  })

  it("el destino del rechazo nunca vuelve a rechazar (sin loop de redirects)", async () => {
    // Al recepcionista se lo manda a /[gymId]/students, que es justo una de las
    // secciones que sí puede ver — si no, rebotaría indefinidamente.
    mockAuth.mockResolvedValue(SESSIONS.receptionist1() as never)
    const to = await redirectFrom(() => requireGymRole(IDS.gym1, [UserRole.OWNER]))
    expect(to).toBe(`/${IDS.gym1}/students`)

    const again = await redirectFrom(() =>
      requireGymRole(IDS.gym1, [UserRole.OWNER, UserRole.RECEPTIONIST]),
    )
    expect(again).toBeNull()
  })
})
