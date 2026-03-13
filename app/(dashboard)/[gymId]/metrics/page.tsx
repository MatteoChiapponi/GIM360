import MetricsView from "./MetricsView"

export default async function MetricsPage({
  params,
}: {
  params: Promise<{ gymId: string }>
}) {
  const { gymId } = await params
  return <MetricsView gymId={gymId} />
}
