import { UserRole } from "@/app/generated/prisma/client"
import { requireGymRole } from "@/lib/guards"
import SettingsView from "./SettingsView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function SettingsPage({ params }: { params: Promise<{ gymId: string }> }) {
  const { gymId } = await params
  await requireGymRole(gymId, [UserRole.OWNER])
  return (
    <ErrorBoundary>
      <SettingsView gymId={gymId} />
    </ErrorBoundary>
  )
}
