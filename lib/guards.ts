import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { UserRole } from "@/app/generated/prisma/client"
import type { Session } from "next-auth"

/** Ruta de entrada de cada rol cuando no puede ver la página pedida. */
function fallbackFor(role: UserRole, gymId: string) {
  if (role === UserRole.RECEPTIONIST) return `/${gymId}/students`
  if (role === UserRole.TRAINER) return "/trainer"
  if (role === UserRole.ADMIN) return "/admin"
  return "/dashboard"
}

/**
 * Guard para páginas dentro de /[gymId]. Devuelve la sesión y saca de la página
 * a quien no tenga uno de los roles permitidos.
 *
 * La pertenencia al gimnasio la verifica el layout de /[gymId]; acá solo va el rol.
 */
export async function requireGymRole(gymId: string, roles: UserRole[]): Promise<Session> {
  const session = await auth()
  if (!session) redirect("/login")

  if (!roles.includes(session.user.role)) {
    redirect(fallbackFor(session.user.role, gymId))
  }

  return session
}
