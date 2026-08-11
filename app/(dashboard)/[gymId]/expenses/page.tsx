import { UserRole } from "@/app/generated/prisma/client"
import { requireGymRole } from "@/lib/guards"
import ExpensesView from "./ExpensesView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function ExpensesPage({ params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params
  await requireGymRole(gymId, [UserRole.OWNER])
  return (
    <ErrorBoundary>
      <ExpensesView gymId={gymId} />
    </ErrorBoundary>
  )
}
