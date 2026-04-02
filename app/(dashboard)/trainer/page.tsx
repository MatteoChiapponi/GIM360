import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import TrainerDashboardView from "./TrainerDashboardView"

export default async function TrainerDashboardPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role !== "TRAINER") redirect("/dashboard")
  return <TrainerDashboardView />
}
