import { describe, it, expect } from "vitest"
import { UserRole } from "@/app/generated/prisma/client"
import { resolveRoleRedirect, ROLE_HOME } from "@/lib/role-routing"

const ROLES = [UserRole.ADMIN, UserRole.OWNER, UserRole.TRAINER, UserRole.RECEPTIONIST]

describe("resolveRoleRedirect — recepcionista", () => {
  it("manda el selector de gimnasios a /reception", () => {
    expect(resolveRoleRedirect(UserRole.RECEPTIONIST, "/dashboard")).toBe("/reception")
    expect(resolveRoleRedirect(UserRole.RECEPTIONIST, "/")).toBe("/reception")
  })

  it("lo deja quedarse en su área de gimnasio", () => {
    expect(resolveRoleRedirect(UserRole.RECEPTIONIST, "/gym-1/students")).toBeNull()
    expect(resolveRoleRedirect(UserRole.RECEPTIONIST, "/gym-1/payments")).toBeNull()
    expect(resolveRoleRedirect(UserRole.RECEPTIONIST, "/gym-1/attendance")).toBeNull()
  })

  it("lo saca de /admin y /trainer", () => {
    expect(resolveRoleRedirect(UserRole.RECEPTIONIST, "/admin")).toBe("/reception")
    expect(resolveRoleRedirect(UserRole.RECEPTIONIST, "/trainer")).toBe("/reception")
    expect(resolveRoleRedirect(UserRole.RECEPTIONIST, "/trainer/attendance")).toBe("/reception")
  })

  it("lo deja en /reception", () => {
    expect(resolveRoleRedirect(UserRole.RECEPTIONIST, "/reception")).toBeNull()
  })
})

describe("resolveRoleRedirect — el resto de los roles", () => {
  it("saca de /reception a quien no es recepcionista", () => {
    expect(resolveRoleRedirect(UserRole.OWNER, "/reception")).toBe("/dashboard")
    expect(resolveRoleRedirect(UserRole.TRAINER, "/reception")).toBe("/trainer")
    expect(resolveRoleRedirect(UserRole.ADMIN, "/reception")).toBe("/admin")
  })

  it("confina al admin en /admin y al trainer en /trainer", () => {
    expect(resolveRoleRedirect(UserRole.ADMIN, "/dashboard")).toBe("/admin")
    expect(resolveRoleRedirect(UserRole.ADMIN, "/gym-1/students")).toBe("/admin")
    expect(resolveRoleRedirect(UserRole.ADMIN, "/admin/whatever")).toBeNull()

    expect(resolveRoleRedirect(UserRole.TRAINER, "/dashboard")).toBe("/trainer")
    expect(resolveRoleRedirect(UserRole.TRAINER, "/gym-1/students")).toBe("/trainer")
    expect(resolveRoleRedirect(UserRole.TRAINER, "/trainer/attendance")).toBeNull()
  })

  it("no toca al owner salvo en áreas ajenas", () => {
    expect(resolveRoleRedirect(UserRole.OWNER, "/dashboard")).toBeNull()
    expect(resolveRoleRedirect(UserRole.OWNER, "/gym-1/metrics")).toBeNull()
    expect(resolveRoleRedirect(UserRole.OWNER, "/gym-1/receptionists")).toBeNull()
    expect(resolveRoleRedirect(UserRole.OWNER, "/admin")).toBe("/dashboard")
    expect(resolveRoleRedirect(UserRole.OWNER, "/trainer")).toBe("/dashboard")
  })
})

describe("resolveRoleRedirect — prefijos que no deben colisionar", () => {
  it("/receptionists no es el área /reception", () => {
    // La página del owner es /[gymId]/receptionists; un prefijo mal escrito
    // (startsWith('/reception')) la trataría como área del recepcionista.
    expect(resolveRoleRedirect(UserRole.OWNER, "/gym-1/receptionists")).toBeNull()
    expect(resolveRoleRedirect(UserRole.RECEPTIONIST, "/receptionists")).toBeNull()
    expect(resolveRoleRedirect(UserRole.OWNER, "/receptionists")).toBeNull()
  })

  it("/[gymId]/trainers no es el área /trainer", () => {
    expect(resolveRoleRedirect(UserRole.OWNER, "/gym-1/trainers")).toBeNull()
  })
})

describe("resolveRoleRedirect — invariante: ningún redirect encadena otro", () => {
  const PATHS = [
    "/",
    "/dashboard",
    "/admin",
    "/admin/algo",
    "/trainer",
    "/trainer/attendance",
    "/reception",
    "/receptionists",
    "/gym-1",
    "/gym-1/students",
    "/gym-1/payments",
    "/gym-1/attendance",
    "/gym-1/metrics",
    "/gym-1/receptionists",
    "/gym-1/groups/group-1",
    "/ruta/inventada",
  ]

  it.each(ROLES)("%s llega a destino en un solo salto", (role) => {
    for (const path of PATHS) {
      const first = resolveRoleRedirect(role, path)
      if (first === null) continue

      const second = resolveRoleRedirect(role, first)
      expect(
        second,
        `${role} en ${path} → ${first} → ${second} (redirect encadenado)`,
      ).toBeNull()
    }
  })

  it.each(ROLES)("la entrada de %s es un punto fijo", (role) => {
    expect(resolveRoleRedirect(role, ROLE_HOME[role])).toBeNull()
  })
})
