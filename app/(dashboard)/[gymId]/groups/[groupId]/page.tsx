import { UserRole } from "@/app/generated/prisma/client"
import { requireGymRole } from "@/lib/guards"
import GroupDetailView from "./GroupDetailView"

export default async function GroupDetailPage({ params }: { params: Promise<{ gymId: string; groupId: string }> }) {
  const { gymId, groupId } = await params
  await requireGymRole(gymId, [UserRole.OWNER])
  return <GroupDetailView gymId={gymId} groupId={groupId} />
}
