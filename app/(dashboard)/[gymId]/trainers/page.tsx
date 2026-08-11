import { UserRole } from "@/app/generated/prisma/client"
import { requireGymRole } from "@/lib/guards"
import TrainersView from "./TrainersView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function TrainersPage({ params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params
  await requireGymRole(gymId, [UserRole.OWNER])
  return (
    <ErrorBoundary>
      <TrainersView gymId={gymId} />
    </ErrorBoundary>
  )
}
