import { UserRole } from "@/app/generated/prisma/client"
import { requireGymRole } from "@/lib/guards"
import PaymentsView from "./PaymentsView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ gymId: string }>
}) {
  const { gymId } = await params
  const session = await requireGymRole(gymId, [UserRole.OWNER, UserRole.RECEPTIONIST])
  return (
    <ErrorBoundary>
      {/* El cierre de caja es del owner — la vista lo oculta para recepción. */}
      <PaymentsView gymId={gymId} canCloseCash={session.user.role === UserRole.OWNER} />
    </ErrorBoundary>
  )
}
