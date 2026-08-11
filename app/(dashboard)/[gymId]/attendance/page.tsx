import { UserRole } from "@/app/generated/prisma/client"
import { requireGymRole } from "@/lib/guards"
import AttendanceView from "./AttendanceView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ gymId: string }>
}) {
  const { gymId } = await params
  await requireGymRole(gymId, [UserRole.OWNER, UserRole.RECEPTIONIST])
  return (
    <ErrorBoundary>
      <AttendanceView gymId={gymId} />
    </ErrorBoundary>
  )
}
