"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { StatusDot } from "@/components/ui/StatusDot"
import { Tabs } from "@/components/ui/Tabs"

// ─── Types ────────────────────────────────────────────────────────────────────

type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"

type GroupSchedule = {
  id: string
  weekDays: DayOfWeek[]
  startTime: string
  endTime: string
}

type EnrolledGroup = {
  id: string
  enrolledAt: string
  group: {
    id: string
    name: string
    monthlyPrice: string
    schedules: GroupSchedule[]
  }
}

type StudentDetail = {
  id: string
  firstName: string
  lastName: string
  phone: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
  birthDate: string | null
  nationalId: string | null
  joinedAt: string
  leftAt: string | null
  dueDay: number
  groups: EnrolledGroup[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_SHORT: Record<DayOfWeek, string> = {
  MONDAY: "Lun", TUESDAY: "Mar", WEDNESDAY: "Mié",
  THURSDAY: "Jue", FRIDAY: "Vie", SATURDAY: "Sáb", SUNDAY: "Dom",
}

const DAY_ORDER: Record<DayOfWeek, number> = {
  MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5, SUNDAY: 6,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("es-AR")
}

function fmtCurrency(value: string) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 0,
  }).format(parseFloat(value))
}

function fmtSchedule(s: GroupSchedule) {
  const days = [...s.weekDays]
    .sort((a, b) => DAY_ORDER[a] - DAY_ORDER[b])
    .map((d) => DAY_SHORT[d])
    .join(" · ")
  return `${days}  ${s.startTime}–${s.endTime}`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#F0EFEB] last:border-0">
      <span className="text-xs font-medium text-[#A5A49D] uppercase tracking-[0.1em] shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-[#111110] text-right">{children}</span>
    </div>
  )
}

function InfoTab({ student }: { student: StudentDetail }) {
  return (
    <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 divide-y divide-[#F0EFEB]">
      <InfoRow label="Nombre">{student.firstName} {student.lastName}</InfoRow>
      <InfoRow label="Estado">
        {student.leftAt === null
          ? <StatusDot dotColor="bg-emerald-500" textColor="text-emerald-700" label="Activo" />
          : <StatusDot dotColor="bg-red-500" textColor="text-red-700" label={`Baja · ${fmtDate(student.leftAt)}`} />
        }
      </InfoRow>
<InfoRow label="Teléfono">{student.phone ?? <span className="text-[#A5A49D]">—</span>}</InfoRow>
      <InfoRow label="Contacto de emergencia">{student.emergencyContact ?? <span className="text-[#A5A49D]">—</span>}</InfoRow>
      <InfoRow label="Tel. emergencia">{student.emergencyPhone ?? <span className="text-[#A5A49D]">—</span>}</InfoRow>
      <InfoRow label="DNI">{student.nationalId ?? <span className="text-[#A5A49D]">—</span>}</InfoRow>
      <InfoRow label="Fecha de nacimiento">{fmtDate(student.birthDate)}</InfoRow>
      <InfoRow label="Fecha de ingreso">{fmtDate(student.joinedAt)}</InfoRow>
      <InfoRow label="Día de cobro">{student.dueDay}</InfoRow>
    </div>
  )
}

function GroupsTab({ groups, gymId }: { groups: EnrolledGroup[]; gymId: string }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-12 text-center">
        <p className="text-sm text-[#68685F]">Este alumno no está inscripto en ningún grupo.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {groups.map((eg) => (
        <div key={eg.id} className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link
                href={`/${gymId}/groups/${eg.group.id}`}
                className="font-medium text-[#111110] hover:text-[#68685F] transition-colors"
              >
                {eg.group.name}
              </Link>
              <p className="mt-0.5 text-xs text-[#A5A49D]">
                Inscripto desde {fmtDate(eg.enrolledAt)}
              </p>
            </div>
            <span className="font-mono text-sm font-semibold text-[#111110] shrink-0">
              {fmtCurrency(eg.group.monthlyPrice)}<span className="text-[#A5A49D] font-normal">/mes</span>
            </span>
          </div>

          {eg.group.schedules.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {eg.group.schedules.map((s) => (
                <p key={s.id} className="text-xs text-[#68685F]">{fmtSchedule(s)}</p>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type DetailTab = "info" | "groups"

export default function StudentDetailView({ gymId, studentId }: { gymId: string; studentId: string }) {
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>("info")

  const fetchStudent = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/students/${studentId}?gymId=${gymId}`)
      if (!res.ok) { setError("No se pudo cargar el alumno."); return }
      setStudent(await res.json())
    } catch { setError("Error de red.") }
    finally { setLoading(false) }
  }, [gymId, studentId])

  useEffect(() => { fetchStudent() }, [fetchStudent])

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div>
        <Link
          href={`/${gymId}/students`}
          className="text-xs font-medium text-[#A5A49D] hover:text-[#68685F] transition-colors"
        >
          ← Alumnos
        </Link>

        {loading ? (
          <div className="mt-2 h-7 w-48 animate-pulse rounded-md bg-[#F0EFEB]" />
        ) : student ? (
          <div className="mt-2">
            <h1 className="text-xl font-semibold text-[#111110]">
              {student.firstName} {student.lastName}
            </h1>
            <p className="mt-0.5 text-sm text-[#A5A49D]">
              {student.groups.length} {student.groups.length === 1 ? "grupo" : "grupos"}
              {" · "}día de cobro {student.dueDay}
            </p>
          </div>
        ) : null}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && student && (
        <>
          <Tabs<DetailTab>
            tabs={[
              { key: "info", label: "Información" },
              { key: "groups", label: `Grupos (${student.groups.length})` },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === "info" && <InfoTab student={student} />}
          {activeTab === "groups" && <GroupsTab groups={student.groups} gymId={gymId} />}
        </>
      )}
    </div>
  )
}
