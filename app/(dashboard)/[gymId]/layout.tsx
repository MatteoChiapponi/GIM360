import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { gymBelongsToOwner, gymIsActive } from "@/modules/belongs/belongs.service"

export default async function GymLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ gymId: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { gymId } = await params

  if (!await gymBelongsToOwner(gymId, session.user.id)) redirect("/dashboard")
  if (!await gymIsActive(gymId)) redirect("/dashboard")

  return <>{children}</>
}
