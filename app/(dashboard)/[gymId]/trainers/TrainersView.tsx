"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useFetch } from "@/hooks/useFetch"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { FormField } from "@/components/ui/FormField"
import { NumberInput } from "@/components/ui/NumberInput"
import { InfoTooltip } from "@/components/ui/InfoTooltip"
import { Select } from "@/components/ui/Select"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchToolbar } from "@/components/ui/SearchToolbar"
import { DataTable } from "@/components/ui/DataTable"
import { FormModal } from "@/components/ui/FormModal"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

// ─── Types ──────────────────────────────────────────────────────────────────

type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"

type TrainerScheduleEntry = { weekDay: string; startTime: string; endTime: string }

type TrainerGroupAssignment = {
  id: string
  hourlyRate: string
  group: { id: string; name: string }
  schedules: TrainerScheduleEntry[]
}

type Trainer = {
  id: string
  name: string
  active: boolean
  startedAt: string | null
  userId: string | null
  groups: TrainerGroupAssignment[]
}

type GroupSchedule = { weekDays: DayOfWeek[]; startTime: string; endTime: string }
type GymGroup = { id: string; name: string; schedules: GroupSchedule[] }

type DayEntry = { checked: boolean; startTime: string; endTime: string }
type GroupAssignForm = { groupId: string; hourlyRate: string; days: Partial<Record<DayOfWeek, DayEntry>> }

const EMPTY_ASSIGN: GroupAssignForm = { groupId: "", hourlyRate: "", days: {} }

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAYS: { value: DayOfWeek; short: string }[] = [
  { value: "MONDAY", short: "Lun" }, { value: "TUESDAY", short: "Mar" }, { value: "WEDNESDAY", short: "Mié" },
  { value: "THURSDAY", short: "Jue" }, { value: "FRIDAY", short: "Vie" }, { value: "SATURDAY", short: "Sáb" }, { value: "SUNDAY", short: "Dom" },
]

const DAY_SHORT: Record<string, string> = {
  MONDAY: "Lun", TUESDAY: "Mar", WEDNESDAY: "Mié",
  THURSDAY: "Jue", FRIDAY: "Vie", SATURDAY: "Sáb", SUNDAY: "Dom",
}

function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function computeMonthlyPay(groups: TrainerGroupAssignment[]): number {
  return groups.reduce((total, tg) => {
    const rate = Number(tg.hourlyRate)
    const minutes = tg.schedules.reduce((sum, s) => {
      return sum + (parseMinutes(s.endTime) - parseMinutes(s.startTime))
    }, 0)
    // rate per hour × (minutes / 60) × 4.33 weeks/month
    return total + rate * (minutes / 60) * 4.33
  }, 0)
}

function formatCurrency(n: number): string {
  return `$${Math.round(n).toLocaleString("es-AR")}`
}

function formatSeniority(startedAt: string): string {
  const start = new Date(startedAt)
  const now = new Date()
  let years = now.getFullYear() - start.getFullYear()
  let months = now.getMonth() - start.getMonth()
  if (months < 0) { years -= 1; months += 12 }
  if (years === 0 && months === 0) return "Menos de 1 mes"
  if (years === 0) return `${months} ${months === 1 ? "mes" : "meses"}`
  if (months === 0) return `${years} ${years === 1 ? "año" : "años"}`
  return `${years} ${years === 1 ? "año" : "años"}, ${months} ${months === 1 ? "mes" : "meses"}`
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TrainersView({ gymId }: { gymId: string }) {
  const router = useRouter()
  const { data: trainers, loading, error, refetch } = useFetch<Trainer[]>(
    `/api/trainers?gymId=${gymId}`, [], "No se pudieron cargar los entrenadores.",
  )
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<{ name: string; startedAt: string }>({ name: "", startedAt: "" })
  const [assignForm, setAssignForm] = useState<GroupAssignForm>(EMPTY_ASSIGN)
  const [showGroupSection, setShowGroupSection] = useState(false)
  const [showCredSection, setShowCredSection] = useState(false)
  const [createCredForm, setCreateCredForm] = useState({ email: "", password: "", confirmPassword: "" })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [gymGroups, setGymGroups] = useState<GymGroup[]>([])

  useEffect(() => {
    if (!showForm) return
    const controller = new AbortController()
    fetch(`/api/groups?gymId=${gymId}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : [])
      .then((groups) =>
        setGymGroups(groups.map((g: GymGroup) => ({ id: g.id, name: g.name, schedules: g.schedules })))
      )
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return
      })
    return () => controller.abort()
  }, [showForm, gymId])

  // Detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedTrainer = trainers.find((t) => t.id === selectedId) ?? null

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState<{ name: string; startedAt: string }>({ name: "", startedAt: "" })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Deactivate
  const [confirmId, setConfirmId] = useState<string | null>(null)

  // Credentials
  type CredModalState = { trainerId: string; mode: "assign" | "revoke" } | null
  const [credModal, setCredModal] = useState<CredModalState>(null)
  const [credForm, setCredForm] = useState({ email: "", password: "", confirmPassword: "" })
  const [credSubmitting, setCredSubmitting] = useState(false)
  const [credError, setCredError] = useState<string | null>(null)
  const [newCredentials, setNewCredentials] = useState<{ email: string; temporaryPassword: string } | null>(null)

  const [search, setSearch] = useState("")
  type SortKey = "name" | "groups" | "pay"
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const base = showInactive ? trainers : trainers.filter((t) => t.active)
  const displayed = base
    .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "name") cmp = a.name.localeCompare(b.name)
      else if (sortKey === "groups") cmp = a.groups.length - b.groups.length
      else if (sortKey === "pay") cmp = computeMonthlyPay(a.groups) - computeMonthlyPay(b.groups)
      return sortDir === "asc" ? cmp : -cmp
    })

  const selectedGroup = gymGroups.find((g) => g.id === assignForm.groupId) ?? null

  // Build day map for the selected group's schedules
  const groupDayMap: Partial<Record<DayOfWeek, { startTime: string; endTime: string }>> = {}
  if (selectedGroup) {
    for (const s of selectedGroup.schedules) {
      for (const d of s.weekDays) {
        groupDayMap[d] = { startTime: s.startTime, endTime: s.endTime }
      }
    }
  }
  const groupDays = DAYS.filter((d) => groupDayMap[d.value] !== undefined)

  function toggleDay(day: DayOfWeek) {
    setAssignForm((f) => {
      const current = f.days[day]
      if (current?.checked) {
        const next = { ...f.days }
        delete next[day]
        return { ...f, days: next }
      }
      const times = groupDayMap[day]
      return { ...f, days: { ...f.days, [day]: { checked: true, startTime: times?.startTime ?? "", endTime: times?.endTime ?? "" } } }
    })
  }

  function coverAllDays() {
    const next: Partial<Record<DayOfWeek, DayEntry>> = {}
    for (const d of groupDays) {
      const times = groupDayMap[d.value]!
      next[d.value] = { checked: true, startTime: times.startTime, endTime: times.endTime }
    }
    setAssignForm((f) => ({ ...f, days: next }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) { setFormError("El nombre es obligatorio."); return }

    // Validate group assignment if section is open and group selected
    if (showGroupSection && assignForm.groupId) {
      if (!assignForm.hourlyRate || Number(assignForm.hourlyRate) <= 0) {
        setFormError("La tarifa por hora es obligatoria para asignar a un grupo."); return
      }
      const checkedDays = Object.entries(assignForm.days).filter(([, e]) => e.checked)
      if (checkedDays.length === 0) {
        setFormError("Seleccioná al menos un día de horario."); return
      }
    }

    // Validate credentials if section is open
    if (showCredSection && createCredForm.email) {
      if (createCredForm.password.length < 8) {
        setFormError("La contraseña debe tener al menos 8 caracteres."); return
      }
      if (createCredForm.password !== createCredForm.confirmPassword) {
        setFormError("Las contraseñas no coinciden."); return
      }
    }

    setSubmitting(true)
    const createBody: Record<string, unknown> = { gymId, name: form.name.trim() }
    if (form.startedAt) createBody.startedAt = new Date(form.startedAt).toISOString()
    const res = await fetch("/api/trainers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setFormError(d?.error ?? "No se pudo crear el entrenador.")
      setSubmitting(false)
      return
    }

    const created = await res.json()

    // Optional: assign to group
    if (showGroupSection && assignForm.groupId && assignForm.hourlyRate) {
      const schedules = Object.entries(assignForm.days)
        .filter(([, e]) => e.checked)
        .map(([day, e]) => ({ weekDay: day, startTime: e.startTime, endTime: e.endTime }))

      if (schedules.length > 0) {
        const assignRes = await fetch(`/api/groups/${assignForm.groupId}/trainers?gymId=${gymId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trainerId: created.id, hourlyRate: Number(assignForm.hourlyRate), schedules, forceOverlap: true }),
        })
        if (!assignRes.ok) {
          setFormError("Entrenador creado, pero no se pudo asignar al grupo.")
          setSubmitting(false)
          await refetch()
          return
        }
      }
    }

    // Optional: assign credentials
    if (showCredSection && createCredForm.email) {
      const credRes = await fetch(`/api/trainers/${created.id}/user?gymId=${gymId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: createCredForm.email, password: createCredForm.password }),
      })
      if (credRes.ok) {
        const credData = await credRes.json()
        setNewCredentials(credData)
      } else {
        const d = await credRes.json().catch(() => ({}))
        setFormError(d?.error ?? "Entrenador creado, pero no se pudo asignar el acceso.")
        setSubmitting(false)
        await refetch()
        return
      }
    }

    setForm({ name: "", startedAt: "" }); setAssignForm(EMPTY_ASSIGN); setShowGroupSection(false)
    setCreateCredForm({ email: "", password: "", confirmPassword: "" }); setShowCredSection(false)
    setShowForm(false); await refetch()
    setSubmitting(false)
  }

  async function handleAssignCredentials(e: React.FormEvent) {
    e.preventDefault()
    if (!credModal) return
    setCredError(null)
    if (credForm.password !== credForm.confirmPassword) {
      setCredError("Las contraseñas no coinciden."); return
    }
    setCredSubmitting(true)
    const res = await fetch(`/api/trainers/${credModal.trainerId}/user?gymId=${gymId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: credForm.email, password: credForm.password }),
    })
    if (res.ok) {
      const data = await res.json()
      setCredModal(null)
      setCredForm({ email: "", password: "", confirmPassword: "" })
      setNewCredentials(data)
      await refetch()
    } else {
      const d = await res.json().catch(() => ({}))
      setCredError(d?.error ?? "No se pudo asignar el acceso.")
    }
    setCredSubmitting(false)
  }

  async function handleRevokeCredentials() {
    if (!credModal) return
    const res = await fetch(`/api/trainers/${credModal.trainerId}/user?gymId=${gymId}`, { method: "DELETE" })
    if (res.ok) { setCredModal(null); await refetch() }
    else { const d = await res.json().catch(() => ({})); setCredError(d?.error ?? "No se pudo revocar el acceso.") }
  }

  function openDetail(t: Trainer) {
    setSelectedId(t.id)
    setShowEditModal(false)
    setEditError(null)
  }

  function closeDetail() {
    setSelectedId(null)
    setShowEditModal(false)
    setEditError(null)
  }

  function startEdit() {
    if (!selectedTrainer) return
    const dateValue = selectedTrainer.startedAt
      ? new Date(selectedTrainer.startedAt).toISOString().split("T")[0]
      : ""
    setEditForm({ name: selectedTrainer.name, startedAt: dateValue })
    setShowEditModal(true)
    setEditError(null)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedTrainer) return
    setEditError(null)
    if (!editForm.name.trim()) { setEditError("El nombre es obligatorio."); return }
    setEditSubmitting(true)
    const patchBody: Record<string, unknown> = { name: editForm.name.trim() }
    if (editForm.startedAt) patchBody.startedAt = new Date(editForm.startedAt).toISOString()
    else patchBody.startedAt = null
    const res = await fetch(`/api/trainers/${selectedTrainer.id}?gymId=${gymId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    })
    if (res.ok) { setShowEditModal(false); await refetch() }
    else { const d = await res.json().catch(() => ({})); setEditError(typeof d?.error === "string" ? d.error : "No se pudo actualizar el entrenador.") }
    setEditSubmitting(false)
  }

  async function handleDeactivate(id: string) {
    const res = await fetch(`/api/trainers/${id}?gymId=${gymId}`, { method: "DELETE" })
    if (res.ok) { closeDetail(); await refetch() }
  }

  const activeCount = trainers.filter((t) => t.active).length
  const totalMonthlyCost = trainers
    .filter((t) => t.active)
    .reduce((sum, t) => sum + computeMonthlyPay(t.groups), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entrenadores"
        subtitle="Entrenadores del gimnasio"
        action={<Button onClick={() => { setShowForm(true); setFormError(null) }}>+ Nuevo entrenador</Button>}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Activos</p>
          <p className="mt-1 text-2xl font-semibold text-[#111110]">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D] flex items-center justify-between"><span>Costo mensual est.</span> <InfoTooltip text="Estimación del costo mensual total de entrenadores. Se calcula sumando las horas semanales asignadas × tarifa por hora × 4,33 semanas/mes para cada entrenador." /></p>
          <p className="mt-1 text-2xl font-semibold text-[#111110]">{formatCurrency(totalMonthlyCost)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowInactive((v) => !v)}
          className={`cursor-pointer text-xs font-medium transition-colors ${
            showInactive ? "text-[#111110] underline underline-offset-2" : "text-[#68685F] hover:text-[#111110]"
          }`}
        >
          {showInactive ? "Ocultar inactivos" : "Mostrar inactivos"}
        </button>
      </div>

      <FormModal
        open={showForm}
        title="Nuevo entrenador"
        error={formError}
        onSubmit={handleCreate}
        submitting={submitting}
        onCancel={() => { setShowForm(false); setForm({ name: "", startedAt: "" }); setAssignForm(EMPTY_ASSIGN); setShowGroupSection(false); setCreateCredForm({ email: "", password: "", confirmPassword: "" }); setShowCredSection(false); setFormError(null) }}
        gridCols="sm:grid-cols-1"
      >
        <FormField label="Nombre" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Carlos López" />
        </FormField>
        <FormField label="Fecha de inicio">
          <Input type="date" value={form.startedAt} onChange={(e) => setForm((f) => ({ ...f, startedAt: e.target.value }))} />
        </FormField>

        {/* ── Optional credentials ── */}
        <div className="border-t border-[#F0EFEB] pt-3">
          <button
            type="button"
            onClick={() => { setShowCredSection((v) => !v); if (showCredSection) setCreateCredForm({ email: "", password: "", confirmPassword: "" }) }}
            className="cursor-pointer text-xs font-medium text-[#68685F] hover:text-[#111110] transition-colors"
          >
            {showCredSection ? "− Cancelar acceso al sistema" : "+ Asignar acceso al sistema (opcional)"}
          </button>
          {showCredSection && (
            <div className="mt-3 space-y-4">
              <FormField label="Email" required>
                <Input type="email" value={createCredForm.email} onChange={(e) => setCreateCredForm((f) => ({ ...f, email: e.target.value }))} placeholder="entrenador@email.com" />
              </FormField>
              <FormField label="Contraseña (mínimo 8 caracteres)" required>
                <Input type="text" value={createCredForm.password} onChange={(e) => setCreateCredForm((f) => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
              </FormField>
              <FormField label="Confirmar contraseña" required>
                <Input type="text" value={createCredForm.confirmPassword} onChange={(e) => setCreateCredForm((f) => ({ ...f, confirmPassword: e.target.value }))} placeholder="Repetí la contraseña" />
              </FormField>
              <p className="text-xs text-[#68685F]">La contraseña se mostrará una sola vez al crear el entrenador.</p>
            </div>
          )}
        </div>

        {/* ── Optional group assignment ── */}
        <div className="border-t border-[#F0EFEB] pt-3">
          <button
            type="button"
            onClick={() => { setShowGroupSection((v) => !v); if (showGroupSection) setAssignForm(EMPTY_ASSIGN) }}
            className="cursor-pointer text-xs font-medium text-[#68685F] hover:text-[#111110] transition-colors"
          >
            {showGroupSection ? "− Cancelar asignación a grupo" : "+ Asignar a un grupo (opcional)"}
          </button>

          {showGroupSection && (
            <div className="mt-3 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Grupo" required>
                  <Select
                    value={assignForm.groupId}
                    onChange={(e) => setAssignForm((f) => ({ ...f, groupId: e.target.value, days: {} }))}
                  >
                    <option value="">Seleccioná un grupo…</option>
                    {gymGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </Select>
                </FormField>
                <FormField label="Tarifa por hora" required>
                  <NumberInput
                    value={assignForm.hourlyRate}
                    onChange={(e) => setAssignForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                    placeholder="Ej: 2000"
                  />
                </FormField>
              </div>

              {assignForm.groupId && (
                groupDays.length === 0 ? (
                  <p className="text-sm text-[#68685F]">Este grupo no tiene horarios configurados.</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <Label>Horarios *</Label>
                      <button
                        type="button" onClick={coverAllDays}
                        className="cursor-pointer self-start rounded-md border border-[#E5E4E0] px-3 py-1.5 text-xs font-medium text-[#68685F] hover:bg-[#F0EFEB] hover:text-[#111110] transition-colors sm:self-auto"
                      >
                        Cubrir todo el grupo
                      </button>
                    </div>
                    <div className="space-y-2">
                      {groupDays.map((d) => {
                        const entry = assignForm.days[d.value]
                        const checked = entry?.checked ?? false
                        const groupTimes = groupDayMap[d.value]!
                        return (
                          <div key={d.value} className="rounded-lg border border-[#E5E4E0] px-4 py-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                              <label className="flex min-w-[90px] cursor-pointer items-center gap-2.5">
                                <input type="checkbox" checked={checked} onChange={() => toggleDay(d.value)} className="h-4 w-4 rounded border-[#E5E4E0] accent-[#111110]" />
                                <span className={`text-sm font-semibold ${checked ? "text-[#111110]" : "text-[#A5A49D]"}`}>{d.short}</span>
                                <span className="text-xs text-[#A5A49D]">({groupTimes.startTime}–{groupTimes.endTime})</span>
                              </label>
                              {checked && (
                                <div className="flex items-center gap-2">
                                  <Input type="time" value={entry?.startTime ?? ""} onChange={(e) => setAssignForm((f) => ({ ...f, days: { ...f.days, [d.value]: { ...(f.days[d.value] ?? { checked: true, startTime: "", endTime: "" }), startTime: e.target.value } } }))} className="w-[120px]" />
                                  <span className="text-xs text-[#A5A49D]">a</span>
                                  <Input type="time" value={entry?.endTime ?? ""} onChange={(e) => setAssignForm((f) => ({ ...f, days: { ...f.days, [d.value]: { ...(f.days[d.value] ?? { checked: true, startTime: "", endTime: "" }), endTime: e.target.value } } }))} className="w-[120px]" />
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </FormModal>

      <SearchToolbar
        search={search} onSearchChange={setSearch} placeholder="Buscar entrenador…"
        sortOptions={[
          { value: "name", label: "Ordenar por nombre" },
          { value: "groups", label: "Ordenar por grupos" },
          { value: "pay", label: "Ordenar por costo" },
        ]}
        sortKey={sortKey} onSortKeyChange={(k) => setSortKey(k as SortKey)}
        sortDir={sortDir} onSortDirToggle={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
      />

      <DataTable
        columns={[
          { key: "name", header: "Nombre", render: (t) => (
            <div className="flex items-center gap-2">
              <span className={`font-medium ${t.active ? "text-[#111110]" : "text-[#A5A49D]"}`}>{t.name}</span>
              {!t.active && <span className="text-[10px] uppercase tracking-wider text-[#A5A49D] bg-[#F7F6F3] px-1.5 py-0.5 rounded">Inactivo</span>}
            </div>
          )},
          { key: "groups", header: "Grupos", render: (t) => (
            t.groups.length === 0
              ? <span className="text-[#A5A49D] text-xs">Sin grupos</span>
              : <div className="flex flex-wrap gap-1">{t.groups.map((tg) => (
                  <span key={tg.id} className="inline-block text-xs bg-[#F7F6F3] text-[#68685F] px-2 py-0.5 rounded-full">{tg.group.name}</span>
                ))}</div>
          )},
          { key: "pay", header: "Costo/mes Est.", align: "right", render: (t) => (
            <span className="font-mono text-[#111110]">{t.groups.length > 0 ? formatCurrency(computeMonthlyPay(t.groups)) : "—"}</span>
          )},
        ]}
        data={displayed}
        loading={loading}
        error={error}
        emptyMessage={search ? "Sin resultados para esa búsqueda." : showInactive ? "No hay entrenadores registrados." : "No hay entrenadores activos."}
        emptyHint={!search ? "Agregá el primer entrenador con el botón de arriba." : undefined}
        minWidth="500px"
        rowKey={(t) => t.id}
        rowClassName={(t, i) => `transition-colors cursor-pointer hover:bg-[#F0EFEB] ${i > 0 ? "border-t border-[#F7F6F3]" : ""} ${!t.active ? "opacity-60" : ""}`}
        onRowClick={openDetail}
      />

      {/* ─── Detail Panel (slide-over) ────────────────────────────────────── */}
      {selectedTrainer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20" onClick={closeDetail} />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-white shadow-xl border-l border-[#E5E4E0] overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="px-6 py-5 border-b border-[#F0EFEB] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#111110]">{selectedTrainer.name}</h2>
                <p className="text-xs text-[#A5A49D] mt-0.5">
                  {selectedTrainer.active ? "Activo" : "Inactivo"} · {selectedTrainer.groups.length} grupo{selectedTrainer.groups.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button onClick={closeDetail} className="cursor-pointer text-[#A5A49D] hover:text-[#111110] transition-colors p-1">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l12 12M14 2L2 14" /></svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* ── Actions ──────────────────────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={startEdit}>Editar</Button>
                {selectedTrainer.active && (
                  <Button variant="danger" onClick={() => setConfirmId(selectedTrainer.id)}>Desactivar</Button>
                )}
              </div>

              {/* ── Acceso ───────────────────────────────────────────────── */}
              <div className="rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Acceso al sistema</span>
                  {selectedTrainer.userId ? (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Activo
                    </span>
                  ) : (
                    <span className="text-xs text-[#A5A49D]">Sin acceso</span>
                  )}
                </div>
                {selectedTrainer.userId ? (
                  <Button variant="danger" onClick={() => { setCredError(null); setCredModal({ trainerId: selectedTrainer.id, mode: "revoke" }) }}>
                    Revocar acceso
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => { setCredForm({ email: "", password: "", confirmPassword: "" }); setCredError(null); setCredModal({ trainerId: selectedTrainer.id, mode: "assign" }) }}>
                    Asignar acceso
                  </Button>
                )}
              </div>

              {/* ── Info ─────────────────────────────────────────────────── */}
              {selectedTrainer.startedAt && (
                <div className="rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Fecha de inicio</span>
                    <span suppressHydrationWarning className="text-sm font-mono text-[#111110]">
                      {new Date(selectedTrainer.startedAt).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Antigüedad</span>
                    <span suppressHydrationWarning className="text-sm font-medium text-[#68685F]">{formatSeniority(selectedTrainer.startedAt)}</span>
                  </div>
                </div>
              )}

              {/* ── Summary ──────────────────────────────────────────────── */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A5A49D] mb-3">Resumen mensual</h3>
                <div className="rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] px-4 py-3">
                  <p className="text-2xl font-semibold text-[#111110]">{formatCurrency(computeMonthlyPay(selectedTrainer.groups))}</p>
                  <p className="text-xs text-[#68685F] mt-0.5">Costo mensual estimado (4,33 sem/mes)</p>
                </div>
              </div>

              {/* ── Groups breakdown ─────────────────────────────────────── */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A5A49D] mb-3">Grupos asignados</h3>
                {selectedTrainer.groups.length === 0 ? (
                  <p className="text-sm text-[#A5A49D]">No tiene grupos asignados.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedTrainer.groups.map((tg) => {
                      const rate = Number(tg.hourlyRate)
                      const totalMinutes = tg.schedules.reduce((sum, s) => sum + (parseMinutes(s.endTime) - parseMinutes(s.startTime)), 0)
                      const monthlyHours = (totalMinutes / 60) * 4.33
                      const monthlyCost = rate * monthlyHours

                      return (
                        <div key={tg.id} onClick={() => { closeDetail(); router.push(`/${gymId}/groups/${tg.group.id}`) }} className="rounded-lg border border-[#E5E4E0] bg-white p-4 space-y-3 cursor-pointer hover:border-[#C8C7C3] hover:shadow-sm active:bg-[#F7F6F3] transition-all">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-[#111110]">{tg.group.name}</span>
                            <span className="font-mono text-sm text-[#111110]">{formatCurrency(monthlyCost)}/mes</span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[#A5A49D]">Tarifa</span>
                              <p className="font-mono text-[#111110]">{formatCurrency(rate)}/h</p>
                            </div>
                            <div>
                              <span className="text-[#A5A49D]">Horas/mes</span>
                              <p className="font-mono text-[#111110]">{monthlyHours.toFixed(1)}h</p>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Horarios</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {tg.schedules
                                .sort((a, b) => {
                                  const dayOrder = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
                                  return dayOrder.indexOf(a.weekDay) - dayOrder.indexOf(b.weekDay)
                                })
                                .map((s) => (
                                <span key={s.weekDay} className="inline-block text-xs bg-[#F0EFEB] text-[#68685F] px-2 py-1 rounded">
                                  {DAY_SHORT[s.weekDay] ?? s.weekDay} {s.startTime}–{s.endTime}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-[#A5A49D] border-t border-[#F0EFEB] pt-2">
                            <span>{formatCurrency(rate)}/h × {(totalMinutes / 60).toFixed(1)}h/sem × 4,33 = {formatCurrency(monthlyCost)}/mes</span>
                            <span className="text-[#68685F] font-medium flex items-center gap-0.5">Ver grupo <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4"/></svg></span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <FormModal
        open={showEditModal}
        title="Editar entrenador"
        error={editError}
        onSubmit={handleSaveEdit}
        submitting={editSubmitting}
        onCancel={() => { setShowEditModal(false); setEditError(null) }}
        gridCols="sm:grid-cols-1"
      >
        <FormField label="Nombre" required>
          <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Carlos López" />
        </FormField>
        <FormField label="Fecha de inicio">
          <Input type="date" value={editForm.startedAt} onChange={(e) => setEditForm((f) => ({ ...f, startedAt: e.target.value }))} />
        </FormField>
      </FormModal>

      <ConfirmDialog
        open={confirmId !== null}
        title="Desactivar entrenador"
        message="Ya no aparecerá en la lista activa. Podés volver a verlo activando 'Mostrar inactivos'."
        confirmLabel="Desactivar"
        onConfirm={() => { const id = confirmId!; setConfirmId(null); handleDeactivate(id) }}
        onCancel={() => setConfirmId(null)}
      />

      {/* ─── Assign credentials modal ─────────────────────────────────────── */}
      <FormModal
        open={credModal?.mode === "assign"}
        title="Asignar acceso al entrenador"
        error={credError}
        onSubmit={handleAssignCredentials}
        submitting={credSubmitting}
        onCancel={() => { setCredModal(null); setCredForm({ email: "", password: "", confirmPassword: "" }); setCredError(null) }}
        gridCols="sm:grid-cols-1"
        submitLabel="Crear acceso"
      >
        <FormField label="Email" required>
          <Input type="email" value={credForm.email} onChange={(e) => setCredForm((f) => ({ ...f, email: e.target.value }))} placeholder="entrenador@email.com" />
        </FormField>
        <FormField label="Contraseña (mínimo 8 caracteres)" required>
          <Input type="text" value={credForm.password} onChange={(e) => setCredForm((f) => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
        </FormField>
        <FormField label="Confirmar contraseña" required>
          <Input type="text" value={credForm.confirmPassword} onChange={(e) => setCredForm((f) => ({ ...f, confirmPassword: e.target.value }))} placeholder="Repetí la contraseña" />
        </FormField>
        <p className="text-xs text-[#68685F]">La contraseña se mostrará una sola vez. Compartila con el entrenador.</p>
      </FormModal>

      {/* ─── Show credentials once ────────────────────────────────────────── */}
      {newCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20" onClick={() => setNewCredentials(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl border border-[#E5E4E0] p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-[#111110]">Acceso creado</h2>
              <p className="text-xs text-[#68685F] mt-1">Guardá estas credenciales antes de cerrar. No se volverán a mostrar.</p>
            </div>
            <div className="rounded-lg border border-[#E5E4E0] bg-[#F7F6F3] px-4 py-3 space-y-2 font-mono text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#A5A49D] text-xs font-sans">Email</span>
                <span className="text-[#111110] truncate">{newCredentials.email}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#A5A49D] text-xs font-sans">Contraseña</span>
                <span className="text-[#111110]">{newCredentials.temporaryPassword}</span>
              </div>
            </div>
            <Button onClick={() => setNewCredentials(null)} className="w-full">Entendido</Button>
          </div>
        </div>
      )}

      {/* ─── Revoke credentials confirm ───────────────────────────────────── */}
      <ConfirmDialog
        open={credModal?.mode === "revoke"}
        title="Revocar acceso"
        message="El entrenador ya no podrá iniciar sesión. Podés asignarle un nuevo acceso cuando quieras."
        confirmLabel="Revocar"
        onConfirm={handleRevokeCredentials}
        onCancel={() => setCredModal(null)}
      />
    </div>
  )
}
