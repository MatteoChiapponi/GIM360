import { UserRole } from "@/app/generated/prisma/client"
import { requireGymRole } from "@/lib/guards"
import StudentsView from "./StudentsView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function StudentsPage({ params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params
  await requireGymRole(gymId, [UserRole.OWNER, UserRole.RECEPTIONIST])
  return (
    <ErrorBoundary>
      <StudentsView gymId={gymId} />
    </ErrorBoundary>
  )
}
