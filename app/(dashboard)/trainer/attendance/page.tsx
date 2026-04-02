import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import TrainerAttendanceView from "./TrainerAttendanceView"

export default async function TrainerAttendancePage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role !== "TRAINER") redirect("/dashboard")
  return <TrainerAttendanceView />
}
