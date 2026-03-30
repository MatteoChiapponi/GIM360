"use client"

import { useEffect, useState } from "react"
import AttendanceCalendar from "@/app/(dashboard)/trainer/attendance/AttendanceCalendar"

// ─── Types ─────────────────────────────────────────────────────────────────────

type ScheduleInfo = {
  weekDays: string[]
  startTime: string
  endTime: string
}

type AttendanceDetail = {
  students: {
    studentId: string
    studentName: string
    present: boolean
    markedByUserId: string
    markedByName: string
  }[]
}

type AttendanceRecord = {
  id: string
  groupId: string
  date: string
  detail: AttendanceDetail | null
  takenByUserId: string | null
  takenByName: string | null
  group: {
    id: string
    name: string
    schedules: ScheduleInfo[]
  }
}

type StudentEntry = {
  id: string
  student: {
    id: string
    firstName: string
    lastName: string
    status: string
  }
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  gymId: string
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

function todayDateStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

function todayDayOfWeek(): string {
  return ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][new Date().getDay()]
}

function formatDateDisplay(): string {
  const DAY_SHORT: Record<string, string> = {
    SUNDAY: "Dom",
    MONDAY: "Lun",
    TUESDAY: "Mar",
    WEDNESDAY: "Mié",
    THURSDAY: "Jue",
    FRIDAY: "Vie",
    SATURDAY: "Sáb",
  }
  const MONTH_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  const now = new Date()
  const day = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"][now.getDay()]
  return `${DAY_SHORT[day]} ${now.getDate()} ${MONTH_SHORT[now.getMonth()]}`
}

function getScheduleTimeForToday(schedules: ScheduleInfo[]): string {
  const today = todayDayOfWeek()
  const match = schedules.find((s) => s.weekDays.includes(today))
  return match ? `${match.startTime} – ${match.endTime}` : ""
}

// Sort records by start time of today's schedule (earliest first)
function sortByTodayStartTime(records: AttendanceRecord[]): AttendanceRecord[] {
  const today = todayDayOfWeek()
  return [...records].sort((a, b) => {
    const aMatch = a.group.schedules.find((s) => s.weekDays.includes(today))
    const bMatch = b.group.schedules.find((s) => s.weekDays.includes(today))
    const aTime = aMatch?.startTime ?? "99:99"
    const bTime = bMatch?.startTime ?? "99:99"
    return aTime.localeCompare(bTime)
  })
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AttendanceView({ gymId }: Props) {
  // ── State: data ──
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0)

  // ── State: selected group (State 2) ──
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null)
  const [students, setStudents] = useState<StudentEntry[]>([])
  const [presence, setPresence] = useState<Record<string, boolean>>({})
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [studentsError, setStudentsError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Initial data load ──
  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const date = todayDateStr()

        const postRes = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gymId, date }),
        })
        if (!postRes.ok) throw new Error("No se pudo cargar la asistencia del día.")
        const attendanceData: AttendanceRecord[] = await postRes.json()

        setRecords(attendanceData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error inesperado.")
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [gymId])

  // ── Enter checklist view ──
  async function handleSelectRecord(record: AttendanceRecord) {
    setSelectedRecord(record)
    setStudents([])
    setPresence({})
    setStudentsError(null)
    setSubmitError(null)
    setLoadingStudents(true)

    try {
      const res = await fetch(`/api/attendance/${record.id}/students`)
      if (!res.ok) throw new Error("No se pudo cargar los alumnos.")
      const data: StudentEntry[] = await res.json()
      setStudents(data)

      // Pre-fill presence from existing detail; default to false (absent) for new attendance
      const initial: Record<string, boolean> = {}
      for (const entry of data) {
        const sid = entry.student.id
        if (record.detail) {
          const found = record.detail.students.find((s) => s.studentId === sid)
          initial[sid] = found !== undefined ? found.present : false
        } else {
          initial[sid] = false
        }
      }
      setPresence(initial)
    } catch (err) {
      setStudentsError(err instanceof Error ? err.message : "Error inesperado.")
    } finally {
      setLoadingStudents(false)
    }
  }

  // ── Toggle presence for a student ──
  function togglePresence(studentId: string) {
    setPresence((prev) => ({ ...prev, [studentId]: !prev[studentId] }))
  }

  // ── Submit attendance ──
  async function handleSubmit() {
    if (!selectedRecord) return
    setSubmitting(true)
    setSubmitError(null)

    const payload = students.map((entry) => ({
      studentId: entry.student.id,
      studentName: `${entry.student.firstName} ${entry.student.lastName}`,
      present: presence[entry.student.id] ?? false,
    }))

    try {
      const res = await fetch(`/api/attendance/${selectedRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: payload }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string })?.error ?? "No se pudo guardar la asistencia.")
      }
      const updated: AttendanceRecord = await res.json()

      // Update local records list
      setRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))

      // Return to group list
      setCalendarRefreshKey((k) => k + 1)
      setSelectedRecord(null)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error inesperado.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Back to group list ──
  function handleBack() {
    setSelectedRecord(null)
    setStudents([])
    setPresence({})
    setStudentsError(null)
    setSubmitError(null)
  }

  // ── Computed ──
  const today = todayDayOfWeek()
  const todayRecords = sortByTodayStartTime(
    records.filter((r) => r.group.schedules.some((s) => s.weekDays.includes(today))),
  )

  const isUpdating = Boolean(selectedRecord?.detail)
  const presentCount = selectedRecord
    ? students.filter((e) => presence[e.student.id]).length
    : 0

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: State 2 — Student checklist
  // ─────────────────────────────────────────────────────────────────────────────

  if (selectedRecord) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Back row */}
        <div className="flex items-center gap-3 min-h-[44px]">
          <button
            type="button"
            onClick={handleBack}
            className="cursor-pointer flex items-center gap-1.5 text-sm font-medium text-[#68685F] hover:text-[#111110] transition-colors min-h-[44px]"
            aria-label="Volver a grupos"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M10 4L6 8L10 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Grupos
          </button>
          <span className="flex-1 text-center text-sm font-semibold text-[#111110] truncate">
            {selectedRecord.group.name}
          </span>
          {/* Spacer to keep group name visually centered */}
          <span className="invisible text-sm font-medium" aria-hidden="true">
            Grupos
          </span>
        </div>

        {submitError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {submitError}
          </div>
        )}

        {loadingStudents ? (
          <div className="py-20 text-center text-sm text-[#A5A49D]">Cargando…</div>
        ) : studentsError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {studentsError}
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-16 text-center">
            <p className="text-sm text-[#68685F]">No hay alumnos inscriptos en este grupo.</p>
          </div>
        ) : (
          <>
            {/* Counter row */}
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">
                Alumnos
              </p>
              <p className="text-xs font-mono text-[#68685F]">
                {presentCount}/{students.length} presentes
              </p>
            </div>

            {/* Student list */}
            <div className="rounded-xl border border-[#E5E4E0] bg-white overflow-hidden">
              {students.map((entry, i) => {
                const sid = entry.student.id
                const isPresent = presence[sid] ?? false
                return (
                  <button
                    key={sid}
                    type="button"
                    onClick={() => togglePresence(sid)}
                    className={[
                      "cursor-pointer w-full flex items-center justify-between px-4 py-3 min-h-[52px] text-left transition-colors",
                      "hover:bg-[#FAFAF9] active:bg-[#F0EFEB]",
                      i > 0 ? "border-t border-[#F0EFEB]" : "",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "text-sm font-medium",
                        isPresent ? "text-[#111110]" : "text-[#A5A49D]",
                      ].join(" ")}
                    >
                      {entry.student.lastName}, {entry.student.firstName}
                    </span>
                    {/* Checkbox indicator */}
                    <span
                      className={[
                        "flex-shrink-0 ml-4 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors",
                        isPresent
                          ? "bg-emerald-500 border-emerald-500"
                          : "bg-white border-[#C8C7C3]",
                      ].join(" ")}
                      aria-hidden="true"
                    >
                      {isPresent && (
                        <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
                          <path
                            d="M1 4L4 7L10 1"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Submit button */}
            <div className="pt-2 pb-6">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="cursor-pointer w-full min-h-[48px] rounded-lg bg-[#111110] px-4 py-3 text-sm font-medium text-white hover:bg-[#2A2A28] disabled:opacity-40 transition-colors"
              >
                {submitting
                  ? "Guardando…"
                  : isUpdating
                  ? "Actualizar asistencia"
                  : "Guardar asistencia"}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: State 1 — Group list
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">
          Asistencias
        </p>
        <span className="text-xs font-mono text-[#68685F]">{formatDateDisplay()}</span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-[#A5A49D]">Cargando…</div>
      ) : todayRecords.length === 0 ? (
        <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-16 text-center">
          <p className="text-sm text-[#68685F]">No hay clases programadas para hoy.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {todayRecords.map((record) => {

            const time = getScheduleTimeForToday(record.group.schedules)
            const hasTaken = record.detail !== null
            const presentTotal = hasTaken
              ? record.detail!.students.filter((s) => s.present).length
              : 0
            const totalTotal = hasTaken ? record.detail!.students.length : 0

            return (
              <button
                key={record.id}
                type="button"
                onClick={() => handleSelectRecord(record)}
                className="cursor-pointer w-full text-left rounded-xl border border-[#E5E4E0] bg-white px-4 py-4 min-h-[72px] flex items-center justify-between gap-3 hover:bg-[#FAFAF9] active:bg-[#F0EFEB] transition-colors"
              >
                {/* Left: name + time */}
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="font-medium text-sm text-[#111110] truncate">
                    {record.group.name}
                  </span>
                  {time && (
                    <span className="text-xs font-mono text-[#68685F]">{time}</span>
                  )}
                  {record.takenByName && (
                    <span className="text-[11px] text-[#A5A49D]">
                      por {record.takenByName}
                    </span>
                  )}
                </div>

                {/* Right: status + chevron */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {hasTaken ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium text-emerald-700 font-mono">
                        {presentTotal}/{totalTotal}
                      </span>
                      <span className="text-xs text-emerald-700">presentes</span>
                    </>
                  ) : (
                    <>
                      <div className="h-2 w-2 rounded-full bg-[#C8C7C3]" />
                      <span className="text-xs font-medium text-[#A5A49D]">Sin tomar</span>
                    </>
                  )}

                  {/* Chevron */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="text-[#C8C7C3] ml-1"
                    aria-hidden="true"
                  >
                    <path
                      d="M6 4L10 8L6 12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <AttendanceCalendar
        gymId={gymId}
        onSelectRecord={handleSelectRecord}
        refreshKey={calendarRefreshKey}
        statusMode="all-taken"
      />
    </div>
  )
}
