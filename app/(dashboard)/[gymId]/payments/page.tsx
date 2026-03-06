import PaymentsView from "./PaymentsView"

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ gymId: string }>
}) {
  const { gymId } = await params
  return <PaymentsView gymId={gymId} />
}
