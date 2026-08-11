import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function GymPage({ params }: { params: Promise<{ gymId: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")

  const { gymId } = await params

  // El recepcionista no ve métricas — su pantalla inicial es Alumnos.
  redirect(session.user.role === "RECEPTIONIST" ? `/${gymId}/students` : `/${gymId}/metrics`)
}
