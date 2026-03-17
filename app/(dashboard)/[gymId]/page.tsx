import { redirect } from "next/navigation"

export default function GymPage({ params }: { params: { gymId: string } }) {
  redirect(`/${params.gymId}/metrics`)
}
