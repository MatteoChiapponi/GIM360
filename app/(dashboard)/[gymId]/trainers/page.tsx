import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import TrainersView from "./TrainersView"

export default async function TrainersPage({ params }: { params: Promise<{ gymId: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { gymId } = await params
  return <TrainersView gymId={gymId} />
}
