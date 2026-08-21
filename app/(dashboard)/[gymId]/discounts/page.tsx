import { UserRole } from "@/app/generated/prisma/client"
import { requireGymRole } from "@/lib/guards"
import DiscountsView from "./DiscountsView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function DiscountsPage({ params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params
  await requireGymRole(gymId, [UserRole.OWNER])
  return (
    <ErrorBoundary>
      <DiscountsView gymId={gymId} />
    </ErrorBoundary>
  )
}
