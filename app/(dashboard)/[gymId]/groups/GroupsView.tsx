"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useFetch } from "@/hooks/useFetch"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { NumberInput } from "@/components/ui/NumberInput"
import { FormField } from "@/components/ui/FormField"
import { Label } from "@/components/ui/Label"
import { StatCard } from "@/components/ui/StatCard"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchToolbar } from "@/components/ui/SearchToolbar"
import { DataTable } from "@/components/ui/DataTable"
import { FormModal } from "@/components/ui/FormModal"
import { StatusDot } from "@/components/ui/StatusDot"

type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"

type TrainerScheduleEntry = { weekDay: DayOfWeek; startTime: string; endTime: string }
type AssignedTrainer = {
  id: string
  hourlyRate: string
  trainer: { id: string; name: string }
  schedules: TrainerScheduleEntry[]
}
type GroupSchedule = { id: string; weekDays: DayOfWeek[]; startTime: string; endTime: string }

type Group = {
  id: string
  name: string
  monthlyPrice: string
  maxCapacity: number | null
  _count: { students: number }
  trainers: AssignedTrainer[]
  schedules: GroupSchedule[]
}

// ─── Coverage helpers ────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

type CoverageStatus = "full" | "partial" | "none" | "no-schedule"

function computeGroupCoverage(group: Group): CoverageStatus {
  if (group.schedules.length === 0) return "no-schedule"
  if (group.trainers.length === 0) return "none"

  // Build day → group time range map
  const dayMap: Partial<Record<DayOfWeek, { start: number; end: number }>> = {}
  for (const s of group.schedules) {
    for (const d of s.weekDays) {
      dayMap[d] = { start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) }
    }
  }

  let allCovered = true
  let anyCovered = false

  for (const [day, range] of Object.entries(dayMap) as [DayOfWeek, { start: number; end: number }][]) {
    const intervals = group.trainers
      .flatMap((t) => t.schedules.filter((s) => s.weekDay === day))
      .map((s) => ({ s: Math.max(timeToMinutes(s.startTime), range.start), e: Math.min(timeToMinutes(s.endTime), range.end) }))
      .filter((i) => i.s < i.e)
      .sort((a, b) => a.s - b.s)

    let cursor = range.start
    for (const iv of intervals) {
      if (iv.s > cursor) { allCovered = false; break }
      cursor = Math.max(cursor, iv.e)
    }
    if (cursor < range.end) allCovered = false
    if (intervals.length > 0) anyCovered = true
  }

  if (allCovered) return "full"
  if (anyCovered) return "partial"
  return "none"
}

const COVERAGE_CONFIG: Record<CoverageStatus, { dot: string; text: string; label: string }> = {
  full: { dot: "bg-emerald-500", text: "text-emerald-700", label: "Todas las horas cubiertas" },
  partial: { dot: "bg-amber-400", text: "text-amber-700", label: "Faltan horas por cubrir" },
  none: { dot: "bg-red-500", text: "text-red-700", label: "Sin entrenador asignado" },
  "no-schedule": { dot: "bg-[#A5A49D]", text: "text-[#A5A49D]", label: "Sin horarios definidos" },
}

const DAYS: { value: DayOfWeek; short: string }[] = [
  { value: "MONDAY", short: "Lun" }, { value: "TUESDAY", short: "Mar" }, { value: "WEDNESDAY", short: "Mié" },
  { value: "THURSDAY", short: "Jue" }, { value: "FRIDAY", short: "Vie" }, { value: "SATURDAY", short: "Sáb" },
  { value: "SUNDAY", short: "Dom" },
]

type ScheduleRow = { weekDays: DayOfWeek[]; startTime: string; endTime: string; startDate: string }
const EMPTY_SCHEDULE_ROW: ScheduleRow = { weekDays: [], startTime: "", endTime: "", startDate: "" }

type NewGroupForm = { name: string; monthlyPrice: string; maxCapacity: string }
const EMPTY_FORM: NewGroupForm = { name: "", monthlyPrice: "", maxCapacity: "" }

export default function GroupsView({ gymId }: { gymId: string }) {
  const { data: groups, loading, error, refetch } = useFetch<Group[]>(
    `/api/groups?gymId=${gymId}`, [], "No se pudieron cargar los grupos.",
  )
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewGroupForm>(EMPTY_FORM)
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  type SortKey = "name" | "price" | "students" | "coverage"
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const router = useRouter()
  const totalStudents = groups.reduce((sum, g) => sum + g._count.students, 0)

  const displayed = groups
    .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "name") cmp = a.name.localeCompare(b.name)
      else if (sortKey === "price") cmp = Number(a.monthlyPrice) - Number(b.monthlyPrice)
      else if (sortKey === "students") cmp = a._count.students - b._count.students
      else if (sortKey === "coverage") {
        const order: Record<CoverageStatus, number> = { full: 0, partial: 1, none: 2, "no-schedule": 3 }
        cmp = order[computeGroupCoverage(a)] - order[computeGroupCoverage(b)]
      }
      return sortDir === "asc" ? cmp : -cmp
    })

  function updateScheduleRow(idx: number, patch: Partial<ScheduleRow>) {
    setScheduleRows((rows) => rows.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  function toggleScheduleDay(idx: number, day: DayOfWeek) {
    setScheduleRows((rows) => rows.map((r, i) => {
      if (i !== idx) return r
      return { ...r, weekDays: r.weekDays.includes(day) ? r.weekDays.filter((d) => d !== day) : [...r.weekDays, day] }
    }))
  }

  function resetForm() {
    setForm(EMPTY_FORM); setScheduleRows([]); setFormError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) { setFormError("El nombre es obligatorio."); return }
    if (!form.monthlyPrice) { setFormError("El precio mensual es obligatorio."); return }

    // Validate schedule rows if any
    for (let i = 0; i < scheduleRows.length; i++) {
      const s = scheduleRows[i]
      if (s.weekDays.length === 0) { setFormError(`Horario ${i + 1}: seleccioná al menos un día.`); return }
      if (!s.startTime) { setFormError(`Horario ${i + 1}: la hora de inicio es obligatoria.`); return }
      if (!s.endTime) { setFormError(`Horario ${i + 1}: la hora de fin es obligatoria.`); return }
      if (!s.startDate) { setFormError(`Horario ${i + 1}: la fecha de inicio es obligatoria.`); return }
    }

    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        gymId, name: form.name.trim(), monthlyPrice: Number(form.monthlyPrice),
      }
      if (form.maxCapacity) body.maxCapacity = Number(form.maxCapacity)

      const res = await fetch("/api/groups", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setFormError(data?.error ?? "Error al crear el grupo."); return
      }

      const created = await res.json()

      // Create schedules if any
      for (const s of scheduleRows) {
        await fetch(`/api/schedules?gymId=${gymId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId: created.id, weekDays: s.weekDays, startTime: s.startTime, endTime: s.endTime, startDate: new Date(s.startDate).toISOString() }),
        })
      }

      resetForm(); setShowForm(false); await refetch()
    } catch {
      setFormError("Error de conexión.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grupos"
        subtitle="Grupos de entrenamiento del gimnasio"
        action={<Button onClick={() => { setShowForm(true); resetForm() }}>+ Nuevo grupo</Button>}
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Grupos" value={groups.length} />
        <StatCard label="Alumnos" value={totalStudents} />
      </div>

      <FormModal
        open={showForm}
        title="Nuevo grupo"
        error={formError}
        onSubmit={handleSubmit}
        submitting={submitting}
        onCancel={() => { resetForm(); setShowForm(false) }}
        gridCols="sm:grid-cols-3"
      >
        <FormField label="Nombre" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Nivel Inicial" />
        </FormField>
        <FormField label="Precio mensual" required>
          <NumberInput value={form.monthlyPrice} onChange={(e) => setForm((f) => ({ ...f, monthlyPrice: e.target.value }))} placeholder="Ej: 15000" />
        </FormField>
        <FormField label="Capacidad máx.">
          <NumberInput integer value={form.maxCapacity} onChange={(e) => setForm((f) => ({ ...f, maxCapacity: e.target.value }))} placeholder="Sin límite" />
        </FormField>

        {/* ── Horarios (opcional) ──────────────────────────────────────── */}
        <div className="sm:col-span-3 space-y-3 pt-2 border-t border-[#F0EFEB]">
          <div className="flex items-center justify-between">
            <Label>Horarios <span className="normal-case tracking-normal font-normal text-[#A5A49D]">(opcional)</span></Label>
            <button
              type="button"
              onClick={() => setScheduleRows((r) => [...r, { ...EMPTY_SCHEDULE_ROW }])}
              className="cursor-pointer text-xs font-semibold text-[#111110] hover:text-[#68685F] transition-colors"
            >
              + Agregar horario
            </button>
          </div>

          {scheduleRows.length === 0 && (
            <p className="text-xs text-[#A5A49D]">Podés agregar horarios ahora o después desde el detalle del grupo.</p>
          )}

          {scheduleRows.map((row, idx) => (
            <div key={idx} className="rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Horario {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => setScheduleRows((r) => r.filter((_, i) => i !== idx))}
                  className="cursor-pointer text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  Quitar
                </button>
              </div>

              {/* Days */}
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => {
                  const checked = row.weekDays.includes(d.value)
                  return (
                    <button key={d.value} type="button" onClick={() => toggleScheduleDay(idx, d.value)}
                      className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                        checked ? "bg-[#111110] text-white" : "border border-[#E5E4E0] text-[#68685F] hover:bg-[#F0EFEB] hover:text-[#111110]"
                      }`}
                    >{d.short}</button>
                  )
                })}
              </div>

              {/* Times + start date */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Inicio *</span>
                  <Input type="time" value={row.startTime} onChange={(e) => updateScheduleRow(idx, { startTime: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Fin *</span>
                  <Input type="time" value={row.endTime} onChange={(e) => updateScheduleRow(idx, { endTime: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Desde *</span>
                  <Input type="date" value={row.startDate} onChange={(e) => updateScheduleRow(idx, { startDate: e.target.value })} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </FormModal>

      <SearchToolbar
        search={search} onSearchChange={setSearch} placeholder="Buscar grupo…"
        sortOptions={[
          { value: "name", label: "Ordenar por nombre" },
          { value: "price", label: "Ordenar por precio" },
          { value: "students", label: "Ordenar por alumnos" },
          { value: "coverage", label: "Ordenar por cobertura" },
        ]}
        sortKey={sortKey} onSortKeyChange={(k) => setSortKey(k as SortKey)}
        sortDir={sortDir} onSortDirToggle={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
      />

      <DataTable
        columns={[
          { key: "name", header: "Nombre", render: (g) => <span className="font-medium text-[#111110]">{g.name}</span> },
          { key: "price", header: "Precio/mes", align: "right", render: (g) => <span className="font-mono text-[#68685F]">${Number(g.monthlyPrice).toLocaleString("es-AR")}</span> },
          { key: "capacity", header: "Capacidad", align: "right", render: (g) => g.maxCapacity ?? <span className="text-[#A5A49D]">Sin límite</span> },
          { key: "students", header: "Alumnos", align: "right", render: (g) => <span className="font-mono text-[#111110]">{g._count.students}</span> },
          { key: "coverage", header: "Horas cubiertas", render: (g) => {
            const status = computeGroupCoverage(g)
            const cfg = COVERAGE_CONFIG[status]
            return <StatusDot dotColor={cfg.dot} textColor={cfg.text} label={cfg.label} />
          }},
        ]}
        data={displayed}
        loading={loading}
        error={error}
        emptyMessage={search ? "Sin resultados para esa búsqueda." : "No hay grupos registrados."}
        emptyHint={!search ? "Creá el primer grupo con el botón de arriba." : undefined}
        minWidth="640px"
        rowKey={(g) => g.id}
        onRowClick={(g) => router.push(`/${gymId}/groups/${g.id}`)}
      />
    </div>
  )
}
