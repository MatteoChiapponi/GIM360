import { UserRole } from "@/app/generated/prisma/client"
import { requireGymRole } from "@/lib/guards"
import StudentsView from "./StudentsView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function StudentsPage({ params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params
  const session = await requireGymRole(gymId, [UserRole.OWNER, UserRole.RECEPTIONIST])
  return (
    <ErrorBoundary>
      {/* Los descuentos los configura el dueño; recepción solo ve el monto ya aplicado. */}
      <StudentsView gymId={gymId} canManageDiscounts={session.user.role === UserRole.OWNER} />
    </ErrorBoundary>
  )
}
