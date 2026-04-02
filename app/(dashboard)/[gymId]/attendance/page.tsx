import AttendanceView from "./AttendanceView"
import { ErrorBoundary } from "@/components/ui/ErrorBoundary"

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ gymId: string }>
}) {
  const { gymId } = await params
  return (
    <ErrorBoundary>
      <AttendanceView gymId={gymId} />
    </ErrorBoundary>
  )
}
