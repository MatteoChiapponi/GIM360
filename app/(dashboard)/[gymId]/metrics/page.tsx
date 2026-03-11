import MetricsView from "./MetricsView"

export default async function MetricsPage({
  params,
}: {
  params: Promise<{ gymId: string }>
}) {
  const { gymId } = await params
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <MetricsView gymId={gymId} />
    </main>
  )
}
