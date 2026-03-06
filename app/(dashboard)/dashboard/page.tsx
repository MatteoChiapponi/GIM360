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

const STATUS_BADGE: Record<GymStatus, { label: string; className: string }> = {
  ACTIVE:    { label: "Activo",              className: "bg-green-100 text-green-800" },
  SUSPENDED: { label: "Suscripción vencida", className: "bg-red-100 text-red-800" },
  INACTIVE:  { label: "Desactivado",         className: "bg-gray-100 text-gray-500" },
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-8">
      <div className="w-full max-w-lg">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Mis gimnasios</h1>
        <p className="mb-6 text-sm text-gray-500">Seleccioná un gimnasio para continuar.</p>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Cargando…</div>
        ) : gyms.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
            No tenés gimnasios registrados.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {gyms.map((gym) => {
              const badge = STATUS_BADGE[gym.status]
              const isActive = gym.status === "ACTIVE"
              return (
                <div
                  key={gym.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-gray-900">{gym.name}</span>
                    {gym.address && (
                      <span className="text-xs text-gray-500">{gym.address}</span>
                    )}
                    <span className={`mt-1 inline-block w-fit rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  {isActive && (
                    <Link
                      href={`/${gym.id}/payments`}
                      className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Ingresar
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-8">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
