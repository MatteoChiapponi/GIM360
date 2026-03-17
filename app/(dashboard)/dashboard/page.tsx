"use client"

import { useState, useEffect } from "react"
import { signOut } from "next-auth/react"
import Link from "next/link"

type GymStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED"

type Gym = {
  id: string
  name: string
  address: string | null
  status: GymStatus
}

const STATUS_CONFIG: Record<GymStatus, { label: string; dot: string; text: string }> = {
  ACTIVE:    { label: "Activo",              dot: "bg-emerald-500", text: "text-emerald-700" },
  SUSPENDED: { label: "Suscripción vencida", dot: "bg-red-500",     text: "text-red-700" },
  INACTIVE:  { label: "Desactivado",         dot: "bg-[#C8C7C3]",   text: "text-[#A5A49D]" },
}

export default function DashboardPage() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/gyms")
      .then((r) => r.json())
      .then((data) => setGyms(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      {/* Top bar */}
      <header className="border-b border-[#E5E4E0] bg-white">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#111110]">
            GYM360
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="cursor-pointer text-xs font-medium text-[#68685F] hover:text-[#111110] transition-colors min-h-[44px] px-2 flex items-center"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#111110]">Mis gimnasios</h1>
          <p className="mt-1.5 text-sm text-[#68685F]">Seleccioná un gimnasio para continuar.</p>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-[#A5A49D]">Cargando…</div>
        ) : gyms.length === 0 ? (
          <div className="rounded-xl border border-[#E5E4E0] bg-white p-12 text-center">
            <p className="text-sm text-[#68685F]">No tenés gimnasios registrados.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[#E5E4E0] bg-white overflow-hidden">
            {gyms.map((gym, i) => {
              const cfg = STATUS_CONFIG[gym.status]
              const isActive = gym.status === "ACTIVE"
              return (
                <div
                  key={gym.id}
                  className={`flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 hover:bg-[#FAFAF9] transition-colors ${
                    i > 0 ? "border-t border-[#F0EFEB]" : ""
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                    <div>
                      <p className="font-medium text-[#111110] text-sm">{gym.name}</p>
                      {gym.address && (
                        <p className="text-xs text-[#A5A49D] mt-0.5">{gym.address}</p>
                      )}
                      <p className={`text-xs mt-1 font-medium ${cfg.text}`}>{cfg.label}</p>
                    </div>
                  </div>

                  {isActive && (
                    <Link
                      href={`/${gym.id}/metrics`}
                      className="flex items-center gap-1.5 text-sm font-medium text-[#111110] hover:text-[#68685F] transition-colors"
                    >
                      Ingresar
                      <span aria-hidden className="text-[#A5A49D]">→</span>
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
