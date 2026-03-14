"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Label } from "@/components/ui/Label"
import { FormField } from "@/components/ui/FormField"
import { Tabs } from "@/components/ui/Tabs"
import { DataTable } from "@/components/ui/DataTable"
import { InlineForm } from "@/components/ui/InlineForm"

// ─── Types ────────────────────────────────────────────────────────────────────

type ContractType = "HOURLY" | "MONTHLY"
type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"

type Schedule = { id: string; weekDays: DayOfWeek[]; startTime: string; endTime: string; startDate: string }
type EnrolledStudent = { id: string; enrolledAt: string; student: { id: string; firstName: string; lastName: string } }
type AssignedTrainer = { id: string; hourlyRate: string | null; trainer: { id: string; name: string; contractType: ContractType } }

type GroupDetail = {
  id: string; name: string; monthlyPrice: string; maxCapacity: number | null
  schedules: Schedule[]; students: EnrolledStudent[]; trainers: AssignedTrainer[]
}

type GymStudent = { id: string; firstName: string; lastName: string }
type GymTrainer = { id: string; name: string; contractType: ContractType }
type Tab = "info" | "schedules" | "students" | "trainers"

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS: { value: DayOfWeek; label: string; short: string }[] = [
  { value: "MONDAY", label: "Lunes", short: "Lun" },
  { value: "TUESDAY", label: "Martes", short: "Mar" },
  { value: "WEDNESDAY", label: "Miércoles", short: "Mié" },
  { value: "THURSDAY", label: "Jueves", short: "Jue" },
  { value: "FRIDAY", label: "Viernes", short: "Vie" },
  { value: "SATURDAY", label: "Sábado", short: "Sáb" },
  { value: "SUNDAY", label: "Domingo", short: "Dom" },
]

const CONTRACT_LABEL: Record<ContractType, string> = { HOURLY: "Por hora", MONTHLY: "Mensual" }
const DAY_SHORT: Record<DayOfWeek, string> = Object.fromEntries(DAYS.map((d) => [d.value, d.short])) as Record<DayOfWeek, string>

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GroupDetailView({ gymId, groupId }: { gymId: string; groupId: string }) {
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("info")

  const fetchGroup = useCallback(async () => {
    setLoading(true); setError(null)
    const res = await fetch(`/api/groups/${groupId}?gymId=${gymId}`)
    if (res.ok) setGroup(await res.json())
    else setError("No se pudo cargar el grupo.")
    setLoading(false)
  }, [gymId, groupId])

  useEffect(() => { fetchGroup() }, [fetchGroup])

  if (loading) return <div className="py-20 text-center text-sm text-[#A5A49D]">Cargando…</div>
  if (error || !group) return <div className="py-20 text-center text-sm text-red-600">{error ?? "Grupo no encontrado."}</div>

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/${gymId}/groups`} className="text-sm text-[#68685F] hover:text-[#111110] transition-colors">← Grupos</Link>
        <h1 className="mt-2 text-xl font-semibold text-[#111110]">{group.name}</h1>
        <p className="mt-0.5 text-sm text-[#68685F]">Detalle del grupo</p>
      </div>

      <Tabs
        tabs={[
          { key: "info" as Tab, label: "Info" },
          { key: "schedules" as Tab, label: "Horarios" },
          { key: "students" as Tab, label: "Alumnos" },
          { key: "trainers" as Tab, label: "Entrenadores" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "info" && <InfoTab group={group} gymId={gymId} groupId={groupId} onRefresh={fetchGroup} />}
      {tab === "schedules" && <SchedulesTab group={group} gymId={gymId} groupId={groupId} onRefresh={fetchGroup} />}
      {tab === "students" && <StudentsTab group={group} gymId={gymId} groupId={groupId} onRefresh={fetchGroup} />}
      {tab === "trainers" && <TrainersTab group={group} gymId={gymId} groupId={groupId} onRefresh={fetchGroup} />}
    </div>
  )
}

// ─── Shared sub-tab props ─────────────────────────────────────────────────────

type SubTabProps = { group: GroupDetail; gymId: string; groupId: string; onRefresh: () => Promise<void> }

// ─── INFO TAB ─────────────────────────────────────────────────────────────────

function InfoTab({ group, gymId, groupId, onRefresh }: SubTabProps) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name: group.name, monthlyPrice: String(group.monthlyPrice), maxCapacity: group.maxCapacity != null ? String(group.maxCapacity) : "" })
  const [submitting, setSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  function startEdit() {
    setForm({ name: group.name, monthlyPrice: String(group.monthlyPrice), maxCapacity: group.maxCapacity != null ? String(group.maxCapacity) : "" })
    setEditError(null); setEditing(true)
  }

  async function handleSave() {
    setEditError(null)
    if (!form.name.trim()) { setEditError("El nombre es obligatorio."); return }
    if (!form.monthlyPrice) { setEditError("El precio mensual es obligatorio."); return }
    setSubmitting(true)
    const body: Record<string, unknown> = { name: form.name.trim(), monthlyPrice: Number(form.monthlyPrice) }
    if (form.maxCapacity) body.maxCapacity = Number(form.maxCapacity)
    else body.maxCapacity = null

    const res = await fetch(`/api/groups/${groupId}?gymId=${gymId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    if (res.ok) { setEditing(false); await onRefresh() }
    else { const d = await res.json().catch(() => ({})); setEditError(d?.error ?? "Error al guardar.") }
    setSubmitting(false)
  }

  return (
    <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#111110]">Información del grupo</p>
        {!editing && <Button onClick={startEdit}>Editar</Button>}
      </div>

      {editError && <p className="text-sm text-red-600">{editError}</p>}

      {editing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Nombre" required>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </FormField>
            <FormField label="Precio mensual" required>
              <Input type="number" min="0" step="0.01" value={form.monthlyPrice} onChange={(e) => setForm((f) => ({ ...f, monthlyPrice: e.target.value }))} />
            </FormField>
            <FormField label="Capacidad máx.">
              <Input type="number" min="1" value={form.maxCapacity} onChange={(e) => setForm((f) => ({ ...f, maxCapacity: e.target.value }))} placeholder="Sin límite" />
            </FormField>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={submitting}>{submitting ? "Guardando…" : "Guardar"}</Button>
            <Button variant="secondary" onClick={() => { setEditing(false); setEditError(null) }}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Nombre</dt>
            <dd className="mt-1 text-sm font-medium text-[#111110]">{group.name}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Precio mensual</dt>
            <dd className="mt-1 text-sm font-mono font-medium text-[#111110]">${Number(group.monthlyPrice).toLocaleString("es-AR")}/mes</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Capacidad máx.</dt>
            <dd className="mt-1 text-sm font-medium text-[#111110]">{group.maxCapacity ?? <span className="text-[#A5A49D]">Sin límite</span>}</dd>
          </div>
        </dl>
      )}
    </div>
  )
}

// ─── SCHEDULES TAB ────────────────────────────────────────────────────────────

type NewScheduleForm = { weekDays: DayOfWeek[]; startTime: string; endTime: string; startDate: string }
const EMPTY_SCHEDULE: NewScheduleForm = { weekDays: [], startTime: "", endTime: "", startDate: "" }

function SchedulesTab({ group, gymId, groupId, onRefresh }: SubTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewScheduleForm>(EMPTY_SCHEDULE)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function toggleDay(day: DayOfWeek) {
    setForm((f) => ({ ...f, weekDays: f.weekDays.includes(day) ? f.weekDays.filter((d) => d !== day) : [...f.weekDays, day] }))
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setFormError(null)
    if (form.weekDays.length === 0) { setFormError("Seleccioná al menos un día."); return }
    if (!form.startTime) { setFormError("La hora de inicio es obligatoria."); return }
    if (!form.endTime) { setFormError("La hora de fin es obligatoria."); return }
    if (!form.startDate) { setFormError("La fecha de inicio es obligatoria."); return }

    setSubmitting(true)
    const res = await fetch(`/api/schedules?gymId=${gymId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, weekDays: form.weekDays, startTime: form.startTime, endTime: form.endTime, startDate: new Date(form.startDate).toISOString() }),
    })
    if (res.ok) { setForm(EMPTY_SCHEDULE); setShowForm(false); await onRefresh() }
    else { const d = await res.json().catch(() => ({})); setFormError(d?.error ?? "Error al agregar el horario.") }
    setSubmitting(false)
  }

  async function handleDelete(scheduleId: string) {
    setDeletingId(scheduleId)
    const res = await fetch(`/api/schedules/${scheduleId}?gymId=${gymId}`, { method: "DELETE" })
    if (res.ok) await onRefresh()
    setDeletingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#111110]">Horarios</p>
        <Button onClick={() => { setShowForm(true); setFormError(null) }}>+ Agregar horario</Button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-5 space-y-4">
          <p className="text-sm font-semibold text-[#111110]">Nuevo horario</p>
          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex flex-col gap-1.5">
            <Label>Días *</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => {
                const checked = form.weekDays.includes(d.value)
                return (
                  <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      checked ? "bg-[#111110] text-white" : "border border-[#E5E4E0] text-[#68685F] hover:bg-[#F0EFEB] hover:text-[#111110]"
                    }`}
                  >{d.short}</button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Hora inicio" required>
              <Input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
            </FormField>
            <FormField label="Hora fin" required>
              <Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
            </FormField>
            <FormField label="Fecha inicio" required>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
            </FormField>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>{submitting ? "Guardando…" : "Guardar"}</Button>
            <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setForm(EMPTY_SCHEDULE); setFormError(null) }}>Cancelar</Button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-[#E5E4E0] bg-white overflow-hidden">
        {group.schedules.length === 0 ? (
          <div className="py-16 text-center"><p className="text-sm text-[#68685F]">No hay horarios configurados.</p></div>
        ) : (
          <div className="divide-y divide-[#F0EFEB]">
            {group.schedules.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-4 hover:bg-[#FAFAF9] transition-colors">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {s.weekDays.map((d) => (
                      <span key={d} className="rounded-md bg-[#F0EFEB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#68685F]">{DAY_SHORT[d]}</span>
                    ))}
                  </div>
                  <p className="text-sm text-[#111110] font-medium">{s.startTime} – {s.endTime}</p>
                  <p className="text-xs text-[#A5A49D]">Desde {new Date(s.startDate).toLocaleDateString("es-AR")}</p>
                </div>
                <Button variant="danger" onClick={() => handleDelete(s.id)} disabled={deletingId === s.id}>
                  {deletingId === s.id ? "…" : "Eliminar"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── STUDENTS TAB ─────────────────────────────────────────────────────────────

function StudentsTab({ group, gymId, groupId, onRefresh }: SubTabProps) {
  const [gymStudents, setGymStudents] = useState<GymStudent[]>([])
  const [loadingPicker, setLoadingPicker] = useState(false)
  const [selectedStudentId, setSelectedStudentId] = useState("")
  const [enrolling, setEnrolling] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [unenrollingId, setUnenrollingId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)

  const enrolledIds = new Set(group.students.map((s) => s.student.id))

  async function loadGymStudents() {
    setLoadingPicker(true)
    const res = await fetch(`/api/students?gymId=${gymId}`)
    if (res.ok) {
      const data: GymStudent[] = await res.json()
      setGymStudents(data.filter((s) => !enrolledIds.has(s.id)))
    }
    setLoadingPicker(false)
  }

  function handleShowPicker() {
    setShowPicker(true); setEnrollError(null); setSelectedStudentId(""); loadGymStudents()
  }

  async function handleEnroll() {
    setEnrollError(null)
    if (!selectedStudentId) { setEnrollError("Seleccioná un alumno."); return }
    setEnrolling(true)
    const res = await fetch(`/api/groups/${groupId}/students?gymId=${gymId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: selectedStudentId }),
    })
    if (res.ok) { setShowPicker(false); setSelectedStudentId(""); await onRefresh() }
    else { const d = await res.json().catch(() => ({})); setEnrollError(d?.error ?? "Error al inscribir al alumno.") }
    setEnrolling(false)
  }

  async function handleUnenroll(studentId: string) {
    setUnenrollingId(studentId)
    const res = await fetch(`/api/groups/${groupId}/students/${studentId}?gymId=${gymId}`, { method: "DELETE" })
    if (res.ok) await onRefresh()
    setUnenrollingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#111110]">
          Alumnos inscriptos <span className="ml-2 text-xs font-normal text-[#A5A49D]">({group.students.length})</span>
        </p>
        <Button onClick={handleShowPicker}>+ Inscribir alumno</Button>
      </div>

      {showPicker && (
        <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-5 space-y-4">
          <p className="text-sm font-semibold text-[#111110]">Inscribir alumno</p>
          {enrollError && <p className="text-sm text-red-600">{enrollError}</p>}
          {loadingPicker ? (
            <p className="text-sm text-[#A5A49D]">Cargando alumnos…</p>
          ) : gymStudents.length === 0 ? (
            <p className="text-sm text-[#68685F]">No hay alumnos disponibles para inscribir.</p>
          ) : (
            <FormField label="Alumno">
              <Select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)}>
                <option value="">Seleccioná un alumno…</option>
                {gymStudents.map((s) => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
              </Select>
            </FormField>
          )}
          <div className="flex items-center gap-3">
            <Button onClick={handleEnroll} disabled={enrolling || gymStudents.length === 0}>{enrolling ? "Inscribiendo…" : "Confirmar"}</Button>
            <Button variant="secondary" onClick={() => { setShowPicker(false); setEnrollError(null) }}>Cancelar</Button>
          </div>
        </div>
      )}

      <DataTable
        columns={[
          { key: "name", header: "Alumno", render: (e: EnrolledStudent) => <span className="font-medium text-[#111110]">{e.student.firstName} {e.student.lastName}</span> },
          { key: "enrolledAt", header: "Inscripto el", render: (e: EnrolledStudent) => <span className="text-[#68685F]">{new Date(e.enrolledAt).toLocaleDateString("es-AR")}</span> },
          { key: "actions", header: "", align: "right" as const, render: (e: EnrolledStudent) => (
            <Button variant="danger" onClick={() => handleUnenroll(e.student.id)} disabled={unenrollingId === e.student.id}>
              {unenrollingId === e.student.id ? "…" : "Desinscribir"}
            </Button>
          )},
        ]}
        data={group.students}
        loading={false}
        emptyMessage="No hay alumnos inscriptos en este grupo."
        minWidth="400px"
        rowKey={(e) => e.id}
      />
    </div>
  )
}

// ─── TRAINERS TAB ─────────────────────────────────────────────────────────────

function TrainersTab({ group, gymId, groupId, onRefresh }: SubTabProps) {
  const [gymTrainers, setGymTrainers] = useState<GymTrainer[]>([])
  const [loadingPicker, setLoadingPicker] = useState(false)
  const [selectedTrainerId, setSelectedTrainerId] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)

  const assignedIds = new Set(group.trainers.map((t) => t.trainer.id))

  async function loadGymTrainers() {
    setLoadingPicker(true)
    const res = await fetch(`/api/trainers?gymId=${gymId}`)
    if (res.ok) {
      const data: GymTrainer[] = await res.json()
      setGymTrainers(data.filter((t) => !assignedIds.has(t.id)))
    }
    setLoadingPicker(false)
  }

  function handleShowPicker() {
    setShowPicker(true); setAssignError(null); setSelectedTrainerId(""); setHourlyRate(""); loadGymTrainers()
  }

  async function handleAssign() {
    setAssignError(null)
    if (!selectedTrainerId) { setAssignError("Seleccioná un entrenador."); return }
    setAssigning(true)
    const body: Record<string, unknown> = { trainerId: selectedTrainerId }
    if (hourlyRate) body.hourlyRate = Number(hourlyRate)

    const res = await fetch(`/api/groups/${groupId}/trainers?gymId=${gymId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    if (res.ok) { setShowPicker(false); setSelectedTrainerId(""); setHourlyRate(""); await onRefresh() }
    else { const d = await res.json().catch(() => ({})); setAssignError(d?.error ?? "Error al asignar el entrenador.") }
    setAssigning(false)
  }

  async function handleRemove(trainerId: string) {
    setRemovingId(trainerId)
    const res = await fetch(`/api/groups/${groupId}/trainers/${trainerId}?gymId=${gymId}`, { method: "DELETE" })
    if (res.ok) await onRefresh()
    setRemovingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#111110]">
          Entrenadores asignados <span className="ml-2 text-xs font-normal text-[#A5A49D]">({group.trainers.length})</span>
        </p>
        <Button onClick={handleShowPicker}>+ Asignar entrenador</Button>
      </div>

      {showPicker && (
        <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-5 space-y-4">
          <p className="text-sm font-semibold text-[#111110]">Asignar entrenador</p>
          {assignError && <p className="text-sm text-red-600">{assignError}</p>}
          {loadingPicker ? (
            <p className="text-sm text-[#A5A49D]">Cargando entrenadores…</p>
          ) : gymTrainers.length === 0 ? (
            <p className="text-sm text-[#68685F]">No hay entrenadores disponibles para asignar.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Entrenador">
                <Select value={selectedTrainerId} onChange={(e) => setSelectedTrainerId(e.target.value)}>
                  <option value="">Seleccioná un entrenador…</option>
                  {gymTrainers.map((t) => <option key={t.id} value={t.id}>{t.name} — {CONTRACT_LABEL[t.contractType]}</option>)}
                </Select>
              </FormField>
              <FormField label="Tarifa por hora (opcional)">
                <Input type="number" min="0" step="0.01" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="Ej: 2000" />
              </FormField>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button onClick={handleAssign} disabled={assigning || gymTrainers.length === 0}>{assigning ? "Asignando…" : "Confirmar"}</Button>
            <Button variant="secondary" onClick={() => { setShowPicker(false); setAssignError(null) }}>Cancelar</Button>
          </div>
        </div>
      )}

      <DataTable
        columns={[
          { key: "name", header: "Nombre", render: (t: AssignedTrainer) => <span className="font-medium text-[#111110]">{t.trainer.name}</span> },
          { key: "contract", header: "Contrato", render: (t: AssignedTrainer) => <span className="text-[#68685F]">{CONTRACT_LABEL[t.trainer.contractType]}</span> },
          { key: "rate", header: "Tarifa", align: "right" as const, render: (t: AssignedTrainer) => (
            <span className="font-mono text-[#68685F]">
              {t.hourlyRate ? `$${Number(t.hourlyRate).toLocaleString("es-AR")}/h` : <span className="text-[#A5A49D]">—</span>}
            </span>
          )},
          { key: "actions", header: "", align: "right" as const, render: (t: AssignedTrainer) => (
            <Button variant="danger" onClick={() => handleRemove(t.trainer.id)} disabled={removingId === t.trainer.id}>
              {removingId === t.trainer.id ? "…" : "Remover"}
            </Button>
          )},
        ]}
        data={group.trainers}
        loading={false}
        emptyMessage="No hay entrenadores asignados a este grupo."
        minWidth="460px"
        rowKey={(t) => t.id}
      />
    </div>
  )
}
