import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import StudentsView from "./StudentsView"

export default async function StudentsPage({ params }: { params: Promise<{ gymId: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { gymId } = await params
  return <StudentsView gymId={gymId} />
}
