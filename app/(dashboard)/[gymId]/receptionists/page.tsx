import { UserRole } from "@/app/generated/prisma/client"
import { requireGymRole } from "@/lib/guards"
import ReceptionistsView from "./ReceptionistsView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function ReceptionistsPage({ params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params
  await requireGymRole(gymId, [UserRole.OWNER])
  return (
    <ErrorBoundary>
      <ReceptionistsView gymId={gymId} />
    </ErrorBoundary>
  )
}
