import { UserRole } from "@/app/generated/prisma/client"

/**
 * Ruteo por rol del proxy. Vive acá — y no dentro de `proxy.ts` — para poder
 * testearlo: es lógica pura sobre (rol, pathname), sin request ni DB.
 *
 * El proxy corre en edge y solo ve el rol del JWT. La pertenencia real al
 * gimnasio la verifican los server components (`[gymId]/layout.tsx`) y los
 * route handlers (`withAuth` + belongs).
 */

/** Entrada de cada rol: adonde va cuando pide algo que no le corresponde. */
export const ROLE_HOME: Record<UserRole, string> = {
  [UserRole.ADMIN]: "/admin",
  [UserRole.OWNER]: "/dashboard",
  [UserRole.TRAINER]: "/trainer",
  [UserRole.RECEPTIONIST]: "/reception",
}

/** Áreas que pertenecen a un solo rol. */
const EXCLUSIVE_AREAS: { area: string; role: UserRole }[] = [
  { area: "/admin", role: UserRole.ADMIN },
  { area: "/trainer", role: UserRole.TRAINER },
  { area: "/reception", role: UserRole.RECEPTIONIST },
]

/** Roles que además NO pueden salir de su área. */
const CONFINED_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.TRAINER]

/**
 * El owner y el recepcionista comparten `/[gymId]`, así que ninguno está
 * confinado. Lo que el recepcionista no tiene es selector de gimnasios: estas
 * rutas lo mandan a `/reception`, que resuelve el suyo.
 */
const GYM_PICKER_PATHS = ["/", "/dashboard"]

function areaOf(pathname: string): { area: string; role: UserRole } | null {
  return (
    EXCLUSIVE_AREAS.find(
      ({ area }) => pathname === area || pathname.startsWith(`${area}/`),
    ) ?? null
  )
}

/**
 * Devuelve la ruta a la que redirigir, o `null` si el usuario puede quedarse.
 *
 * Garantía: aplicar esta función sobre su propio resultado siempre devuelve
 * `null` — un redirect nunca encadena otro (ver `tests/role-routing.test.ts`).
 */
export function resolveRoleRedirect(role: UserRole, pathname: string): string | null {
  const home = ROLE_HOME[role]
  const match = areaOf(pathname)

  // Área de otro rol.
  if (match && match.role !== role) return home

  // Rol confinado, fuera de su área.
  if (!match && CONFINED_ROLES.includes(role)) return home

  // Recepcionista en el selector de gimnasios.
  if (role === UserRole.RECEPTIONIST && GYM_PICKER_PATHS.includes(pathname)) return home

  return null
}
