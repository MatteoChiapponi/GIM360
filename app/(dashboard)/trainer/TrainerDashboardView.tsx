"use client"

import { useEffect, useState } from "react"
import { signOut } from "next-auth/react"
import Link from "next/link"

// ─── Types ───────────────────────────────────────────────────────────────────

type ScheduleEntry = { weekDay: string; startTime: string; endTime: string }

type GroupAssignment = {
  id: string
  hourlyRate: string
  group: { id: string; name: string }
  schedules: ScheduleEntry[]
}

type TrainerProfile = {
  id: string
  name: string
  active: boolean
  startedAt: string | null
  gym: { id: string; name: string }
  groups: GroupAssignment[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]

const DAY_SHORT: Record<string, string> = {
  MONDAY: "Lun", TUESDAY: "Mar", WEDNESDAY: "Mié",
  THURSDAY: "Jue", FRIDAY: "Vie", SATURDAY: "Sáb", SUNDAY: "Dom",
}

const GROUP_COLORS = [
  { bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-800" },
  { bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-800" },
  { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" },
  { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" },
  { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-800" },
]

function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function computeWeeklyHours(groups: GroupAssignment[]): number {
  return groups.reduce((total, tg) => {
    const minutes = tg.schedules.reduce(
      (sum, s) => sum + (parseMinutes(s.endTime) - parseMinutes(s.startTime)),
      0,
    )
    return total + minutes / 60
  }, 0)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TrainerDashboardView() {
  const [profile, setProfile] = useState<TrainerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch("/api/trainers/me")
      .then((r) => {
        if (!r.ok) throw new Error("Error al cargar tu perfil.")
        return r.json()
      })
      .then((data) => setProfile(data))
      .catch(() => setError("No se pudo cargar tu información. Intentá de nuevo."))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      {/* Top bar */}
      <header className="border-b border-[#E5E4E0] bg-white">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#111110]">GYM360</span>
            {profile && (
              <>
                <span className="text-[#C8C7C3]">/</span>
                <span className="text-xs font-medium text-[#68685F]">{profile.gym.name}</span>
              </>
            )}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="cursor-pointer text-xs font-medium text-[#68685F] hover:text-[#111110] transition-colors min-h-[44px] px-2 flex items-center"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12 space-y-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="py-20 text-center text-sm text-[#A5A49D]">Cargando…</div>
        ) : profile ? (
          <>
            {/* ── Hero ── */}
            <div>
              <h1 className="text-2xl font-semibold text-[#111110]">Hola, {profile.name}</h1>
              <p className="mt-1 text-sm text-[#68685F]">{profile.gym.name}</p>
            </div>

            {/* ── Attendance link ── */}
            <Link
              href="/trainer/attendance"
              className="block rounded-xl border border-[#E5E4E0] bg-white px-5 py-4 hover:bg-[#FAFAF9] transition-colors"
            >
              <p className="text-sm font-medium text-[#111110]">Tomar asistencia</p>
              <p className="mt-0.5 text-xs text-[#68685F]">
                Registrá la asistencia de tus clases de hoy
              </p>
            </Link>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Grupos</p>
                <p className="mt-1 text-2xl font-semibold text-[#111110]">{profile.groups.length}</p>
              </div>
              <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Horas/semana</p>
                <p className="mt-1 text-2xl font-semibold text-[#111110]">
                  {computeWeeklyHours(profile.groups).toFixed(1)}h
                </p>
              </div>
            </div>

            {/* ── Weekly schedule grid ── */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A5A49D] mb-3">Horario semanal</h2>
              <div className="rounded-xl border border-[#E5E4E0] bg-white overflow-hidden">
                <div className="grid grid-cols-7 border-b border-[#F0EFEB]">
                  {DAY_ORDER.map((day) => (
                    <div key={day} className="py-2 text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-[#A5A49D]">
                      {DAY_SHORT[day]}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 min-h-[80px] p-2 gap-1">
                  {DAY_ORDER.map((day) => {
                    const slots = profile.groups
                      .flatMap((tg, groupIdx) =>
                        tg.schedules
                          .filter((s) => s.weekDay === day)
                          .map((s) => ({ ...s, groupName: tg.group.name, colorIdx: groupIdx % GROUP_COLORS.length }))
                      )
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))

                    return (
                      <div key={day} className="flex flex-col gap-1">
                        {slots.length === 0 ? (
                          <span className="text-center text-[10px] text-[#C8C7C3] pt-1">—</span>
                        ) : (
                          slots.map((slot, i) => {
                            const c = GROUP_COLORS[slot.colorIdx]
                            return (
                              <div key={i} className={`rounded px-1 py-1 border text-[9px] font-medium leading-tight ${c.bg} ${c.border} ${c.text}`}>
                                <div className="truncate">{slot.groupName}</div>
                                <div className="opacity-75">{slot.startTime}–{slot.endTime}</div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* ── Groups detail ── */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A5A49D] mb-3">Mis grupos</h2>
              {profile.groups.length === 0 ? (
                <div className="rounded-xl border border-[#E5E4E0] bg-white p-8 text-center">
                  <p className="text-sm text-[#68685F]">No tenés grupos asignados.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {profile.groups.map((tg, idx) => {
                    const c = GROUP_COLORS[idx % GROUP_COLORS.length]
                    const sortedSchedules = [...tg.schedules].sort(
                      (a, b) => DAY_ORDER.indexOf(a.weekDay) - DAY_ORDER.indexOf(b.weekDay),
                    )
                    return (
                      <div key={tg.id} className="rounded-xl border border-[#E5E4E0] bg-white p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[#111110]">{tg.group.name}</span>
                          <span className="text-xs font-mono text-[#68685F]">${Number(tg.hourlyRate).toLocaleString("es-AR")}/h</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {sortedSchedules.map((s) => (
                            <span key={s.weekDay} className={`inline-block rounded px-2 py-1 text-xs font-medium border ${c.bg} ${c.border} ${c.text}`}>
                              {DAY_SHORT[s.weekDay] ?? s.weekDay} {s.startTime}–{s.endTime}
                            </span>
                          ))}
                          {sortedSchedules.length === 0 && (
                            <span className="text-xs text-[#A5A49D]">Sin horarios asignados</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>
    </div>
  )
}
