import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ExpensesView from "./ExpensesView"

export default async function ExpensesPage({ params }: { params: Promise<{ gymId: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { gymId } = await params
  return <ExpensesView gymId={gymId} />
}
