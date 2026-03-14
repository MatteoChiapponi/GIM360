import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import GroupDetailView from "./GroupDetailView"

export default async function GroupDetailPage({ params }: { params: Promise<{ gymId: string; groupId: string }> }) {
  const session = await auth()
  if (!session) redirect("/login")
  const { gymId, groupId } = await params
  return <GroupDetailView gymId={gymId} groupId={groupId} />
}
