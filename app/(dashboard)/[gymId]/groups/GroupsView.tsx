"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useFetch } from "@/hooks/useFetch"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { NumberInput } from "@/components/ui/NumberInput"
import { FormField } from "@/components/ui/FormField"
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

type NewGroupForm = { name: string; monthlyPrice: string; maxCapacity: string }
const EMPTY_FORM: NewGroupForm = { name: "", monthlyPrice: "", maxCapacity: "" }

export default function GroupsView({ gymId }: { gymId: string }) {
  const { data: groups, loading, error, refetch } = useFetch<Group[]>(
    `/api/groups?gymId=${gymId}`, [], "No se pudieron cargar los grupos.",
  )
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewGroupForm>(EMPTY_FORM)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) { setFormError("El nombre es obligatorio."); return }
    if (!form.monthlyPrice) { setFormError("El precio mensual es obligatorio."); return }

    setSubmitting(true)
    const body: Record<string, unknown> = {
      gymId, name: form.name.trim(), monthlyPrice: Number(form.monthlyPrice),
    }
    if (form.maxCapacity) body.maxCapacity = Number(form.maxCapacity)

    const res = await fetch("/api/groups", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    if (res.ok) {
      setForm(EMPTY_FORM); setShowForm(false); await refetch()
    } else {
      const data = await res.json().catch(() => ({}))
      setFormError(data?.error ?? "Error al crear el grupo.")
    }
    setSubmitting(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grupos"
        subtitle="Grupos de entrenamiento del gimnasio"
        action={<Button onClick={() => { setShowForm(true); setFormError(null) }}>+ Nuevo grupo</Button>}
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
        onCancel={() => { setForm(EMPTY_FORM); setFormError(null); setShowForm(false) }}
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
