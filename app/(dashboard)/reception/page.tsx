import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getReceptionistByUserId } from "@/modules/receptionists/receptionists.service"
import { LogoutButton } from "@/components/layout/LogoutButton"

/**
 * Entrada del recepcionista. No tiene selector de gimnasios: lo manda directo al
 * suyo, o le explica por qué no puede entrar (es la única pantalla terminal para
 * este rol — mandarlo a /dashboard lo devolvería acá en loop).
 */
export default async function ReceptionPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role !== "RECEPTIONIST") redirect("/dashboard")

  const receptionist = await getReceptionistByUserId(session.user.id)

  if (!receptionist || !receptionist.active) {
    return (
      <BlockedScreen
        title="Acceso desactivado"
        message="Tu cuenta de recepción no está habilitada. Contactá al responsable del gimnasio."
      />
    )
  }

  if (receptionist.gym.status !== "ACTIVE") {
    return (
      <BlockedScreen
        title="Gimnasio no disponible"
        message={`${receptionist.gym.name} está suspendido o desactivado. Contactá al responsable del gimnasio.`}
      />
    )
  }

  redirect(`/${receptionist.gymId}/students`)
}

function BlockedScreen({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-[#E5E4E0] bg-white px-6 py-8 text-center space-y-3">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#A5A49D]">GYM360</p>
        <h1 className="text-lg font-semibold text-[#111110]">{title}</h1>
        <p className="text-sm text-[#68685F]">{message}</p>
        <div className="pt-2 flex justify-center">
          <LogoutButton label="Cerrar sesión" />
        </div>
      </div>
    </div>
  )
}
