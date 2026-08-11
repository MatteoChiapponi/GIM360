import { UserRole } from "@/app/generated/prisma/client"
import { requireGymRole } from "@/lib/guards"
import GroupsView from "./GroupsView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function GroupsPage({ params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params
  await requireGymRole(gymId, [UserRole.OWNER])
  return (
    <ErrorBoundary>
      <GroupsView gymId={gymId} />
    </ErrorBoundary>
  )
}
