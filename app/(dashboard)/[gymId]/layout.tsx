import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { gymBelongsToOwner, gymIsActive } from "@/modules/belongs/belongs.service"
import { db } from "@/lib/db"
import Link from "next/link"
import { NavLinks } from "@/components/layout/NavLinks"

export default async function GymLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ gymId: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const { gymId } = await params

  if (!await gymBelongsToOwner(gymId, session.user.id)) redirect("/dashboard")
  if (!await gymIsActive(gymId)) redirect("/dashboard")

  const gym = await db.gym.findUnique({ where: { id: gymId }, select: { name: true } })

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      {/* Sticky nav bar */}
      <header className="sticky top-0 z-10 border-b border-[#E5E4E0] bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Brand + gym name (gym name hidden on mobile to save space) */}
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <Link
              href="/dashboard"
              className="text-xs font-semibold tracking-[0.2em] uppercase text-[#111110]"
            >
              GYM360
            </Link>
            {gym?.name && (
              <>
                <span className="text-[#D5D4D0] text-sm select-none hidden sm:inline">/</span>
                <span className="text-sm text-[#68685F] font-medium truncate hidden sm:inline max-w-[160px]">{gym.name}</span>
              </>
            )}
          </div>

          {/* Nav links */}
          <NavLinks gymId={gymId} />

          {/* Back link */}
          <Link
            href="/dashboard"
            className="text-xs font-medium text-[#A5A49D] hover:text-[#111110] transition-colors flex-shrink-0 min-h-[44px] flex items-center"
          >
            ← Volver
          </Link>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  )
}
