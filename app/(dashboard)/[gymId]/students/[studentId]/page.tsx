import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import StudentDetailView from "./StudentDetailView"

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ gymId: string; studentId: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  const { gymId, studentId } = await params
  return <StudentDetailView gymId={gymId} studentId={studentId} />
}
