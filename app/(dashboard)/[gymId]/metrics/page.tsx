import { UserRole } from "@/app/generated/prisma/client"
import { requireGymRole } from "@/lib/guards"
import MetricsView from "./MetricsView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function MetricsPage({
  params,
}: {
  params: Promise<{ gymId: string }>
}) {
  const { gymId } = await params
  await requireGymRole(gymId, [UserRole.OWNER])
  return (
    <ErrorBoundary>
      <MetricsView gymId={gymId} />
    </ErrorBoundary>
  )
}
