import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import PaymentsView from "./PaymentsView"

export default async function PaymentsPage() {
  const session = await auth()
  if (!session) redirect("/login")

  const owner = await db.owner.findFirst({
    where: { userId: session.user.id },
    include: { gyms: { select: { id: true }, take: 1 } },
  })

  const gymId = owner?.gyms[0]?.id
  if (!gymId) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">
        No gym found for this account.
      </div>
    )
  }

  return <PaymentsView gymId={gymId} />
}
