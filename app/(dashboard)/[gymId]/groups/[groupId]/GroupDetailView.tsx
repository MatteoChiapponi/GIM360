"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { NumberInput } from "@/components/ui/NumberInput"
import { Select } from "@/components/ui/Select"
import { Label } from "@/components/ui/Label"
import { FormField } from "@/components/ui/FormField"
import { FormModal } from "@/components/ui/FormModal"
import { Tabs } from "@/components/ui/Tabs"
import { DataTable } from "@/components/ui/DataTable"
import { Skeleton } from "@/components/ui/Skeleton"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

// ─── Types ────────────────────────────────────────────────────────────────────

type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"

type Schedule = { id: string; weekDays: DayOfWeek[]; startTime: string; endTime: string; startDate: string }
type EnrolledStudent = { id: string; enrolledAt: string; student: { id: string; firstName: string; lastName: string } }
type TrainerScheduleEntry = { id: string; weekDay: DayOfWeek; startTime: string; endTime: string }
type AssignedTrainer = {
  id: string
  hourlyRate: string
  trainer: { id: string; name: string }
  schedules: TrainerScheduleEntry[]
}

type GroupDetail = {
  id: string; name: string; monthlyPrice: string; maxCapacity: number | null
  schedules: Schedule[]; students: EnrolledStudent[]; trainers: AssignedTrainer[]
}

type GymStudent = { id: string; firstName: string; lastName: string }
type GymTrainer = { id: string; name: string }
type Tab = "info" | "students" | "trainers"

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

const DAY_SHORT: Record<DayOfWeek, string> = Object.fromEntries(DAYS.map((d) => [d.value, d.short])) as Record<DayOfWeek, string>

type NewScheduleForm = { weekDays: DayOfWeek[]; startTime: string; endTime: string; startDate: string }
const EMPTY_SCHEDULE: NewScheduleForm = { weekDays: [], startTime: "", endTime: "", startDate: "" }

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GroupDetailView({ gymId, groupId }: { gymId: string; groupId: string }) {
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("info")

  const fetchGroup = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/groups/${groupId}?gymId=${gymId}`)
      if (res.ok) setGroup(await res.json())
      else setError("No se pudo cargar el grupo.")
    } catch {
      setError("Error de conexión al cargar el grupo.")
    } finally {
      setLoading(false)
    }
  }, [gymId, groupId])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(null)
    fetch(`/api/groups/${groupId}?gymId=${gymId}`, { signal: controller.signal })
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error("No se pudo cargar el grupo.")
      })
      .then((data) => { setGroup(data); setLoading(false) })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return
        setError(err instanceof Error ? err.message : "Error de conexión al cargar el grupo.")
        setLoading(false)
      })
    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gymId, groupId])

  if (loading) return (
    <div className="rounded-xl border border-[#E5E4E0] bg-white px-6 py-8 space-y-4">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-3.5 w-2/3" />
      <Skeleton className="h-3.5 w-1/2" />
      <Skeleton className="h-3.5 w-3/5" />
    </div>
  )
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
          { key: "students" as Tab, label: "Alumnos" },
          { key: "trainers" as Tab, label: "Entrenadores" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "info" && <InfoTab group={group} gymId={gymId} groupId={groupId} onRefresh={fetchGroup} />}
      {tab === "students" && <StudentsTab group={group} gymId={gymId} groupId={groupId} onRefresh={fetchGroup} />}
      {tab === "trainers" && <TrainersTab group={group} gymId={gymId} groupId={groupId} onRefresh={fetchGroup} />}
    </div>
  )
}

// ─── Shared sub-tab props ─────────────────────────────────────────────────────

type SubTabProps = { group: GroupDetail; gymId: string; groupId: string; onRefresh: () => Promise<void> }

// ─── INFO TAB ─────────────────────────────────────────────────────────────────

function InfoTab({ group, gymId, groupId, onRefresh }: SubTabProps) {
  // ── Edit group state ──
  const [showEditModal, setShowEditModal] = useState(false)
  const [form, setForm] = useState({ name: group.name, monthlyPrice: String(group.monthlyPrice), maxCapacity: group.maxCapacity != null ? String(group.maxCapacity) : "" })
  const [submitting, setSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // ── Schedule state ──
  const [showScheduleForm, setShowScheduleForm] = useState(false)
  const [scheduleForm, setScheduleForm] = useState<NewScheduleForm>(EMPTY_SCHEDULE)
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false)
  const [scheduleFormError, setScheduleFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmScheduleId, setConfirmScheduleId] = useState<string | null>(null)

  // ── Edit schedule state ──
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null)
  const [editScheduleForm, setEditScheduleForm] = useState<NewScheduleForm>(EMPTY_SCHEDULE)
  const [editScheduleSubmitting, setEditScheduleSubmitting] = useState(false)
  const [editScheduleError, setEditScheduleError] = useState<string | null>(null)

  // ── Trainer reassignment confirmation ──
  const [pendingScheduleEdit, setPendingScheduleEdit] = useState<{
    scheduleId: string
    newData: NewScheduleForm
    autoReassign: AssignedTrainer[]
    adapt: AssignedTrainer[]
    unassign: { trainer: AssignedTrainer; remainingSchedules: { weekDay: DayOfWeek; startTime: string; endTime: string }[] }[]
  } | null>(null)

  // ── Warning after edit ──
  const [unassignedWarning, setUnassignedWarning] = useState<{ name: string; reason: string }[] | null>(null)

  function startEdit() {
    setForm({ name: group.name, monthlyPrice: String(group.monthlyPrice), maxCapacity: group.maxCapacity != null ? String(group.maxCapacity) : "" })
    setEditError(null); setShowEditModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
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
    if (res.ok) { setShowEditModal(false); await onRefresh() }
    else { const d = await res.json().catch(() => ({})); setEditError(typeof d?.error === "string" ? d.error : "Error al guardar.") }
    setSubmitting(false)
  }

  function toggleDay(day: DayOfWeek) {
    setScheduleForm((f) => ({ ...f, weekDays: f.weekDays.includes(day) ? f.weekDays.filter((d) => d !== day) : [...f.weekDays, day] }))
  }

  function toggleEditDay(day: DayOfWeek) {
    setEditScheduleForm((f) => ({ ...f, weekDays: f.weekDays.includes(day) ? f.weekDays.filter((d) => d !== day) : [...f.weekDays, day] }))
  }

  function startEditSchedule(s: Schedule) {
    setEditingSchedule(s)
    setEditScheduleForm({
      weekDays: [...s.weekDays],
      startTime: s.startTime,
      endTime: s.endTime,
      startDate: s.startDate.split("T")[0],
    })
    setEditScheduleError(null)
  }

  async function handleEditScheduleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEditScheduleError(null)

    if (editScheduleForm.weekDays.length === 0) { setEditScheduleError("Seleccioná al menos un día."); return }
    if (!editScheduleForm.startTime) { setEditScheduleError("La hora de inicio es obligatoria."); return }
    if (!editScheduleForm.endTime) { setEditScheduleError("La hora de fin es obligatoria."); return }
    if (!editScheduleForm.startDate) { setEditScheduleError("La fecha de inicio es obligatoria."); return }

    const oldSchedule = editingSchedule!

    // Build map of ALL group schedule days (using current/old data)
    const allGroupDayMap: Map<DayOfWeek, { startTime: string; endTime: string }> = new Map()
    for (const s of group.schedules) {
      for (const d of s.weekDays) {
        allGroupDayMap.set(d, { startTime: s.startTime, endTime: s.endTime })
      }
    }

    const autoReassign: AssignedTrainer[] = []
    const adapt: AssignedTrainer[] = [] // trainers that covered old schedule fully but not 100% of all group days — clamp to new times
    const unassign: { trainer: AssignedTrainer; remainingSchedules: { weekDay: DayOfWeek; startTime: string; endTime: string }[] }[] = []

    const oldDays = new Set(oldSchedule.weekDays)
    const newStart = timeToMinutes(editScheduleForm.startTime)
    const newEnd = timeToMinutes(editScheduleForm.endTime)

    for (const t of group.trainers) {
      const hasAffectedSchedules = t.schedules.some((s) => oldDays.has(s.weekDay))
      if (!hasAffectedSchedules) continue

      // Check if trainer covers 100% of ALL group schedule days
      let fullCoverage = true
      for (const [day, times] of allGroupDayMap.entries()) {
        const entry = t.schedules.find((s) => s.weekDay === day)
        if (!entry || entry.startTime !== times.startTime || entry.endTime !== times.endTime) {
          fullCoverage = false
          break
        }
      }

      if (fullCoverage) {
        autoReassign.push(t)
        continue
      }

      // Check per-day relationship between trainer entry and new schedule on affected days
      const hasAllNewDays = editScheduleForm.weekDays.every((day) =>
        t.schedules.some((s) => s.weekDay === day)
      )

      if (hasAllNewDays) {
        // Trainer has entries on all new days — check overlap direction
        let relation: "exact" | "trainer-covers" | "new-covers" | "partial" = "partial"

        const trainerCoversOrEquals = editScheduleForm.weekDays.every((day) => {
          const entry = t.schedules.find((s) => s.weekDay === day)!
          return timeToMinutes(entry.startTime) <= newStart && timeToMinutes(entry.endTime) >= newEnd
        })

        if (trainerCoversOrEquals) {
          // Check if it's an exact match (no change needed) vs trainer being wider (needs clamp)
          const exactMatch = editScheduleForm.weekDays.every((day) => {
            const entry = t.schedules.find((s) => s.weekDay === day)!
            return entry.startTime === editScheduleForm.startTime && entry.endTime === editScheduleForm.endTime
          })
          relation = exactMatch ? "exact" : "trainer-covers"
        } else {
          const newCoversTrainer = editScheduleForm.weekDays.every((day) => {
            const entry = t.schedules.find((s) => s.weekDay === day)!
            return newStart <= timeToMinutes(entry.startTime) && newEnd >= timeToMinutes(entry.endTime)
          })
          if (newCoversTrainer) relation = "new-covers"
        }

        if (relation === "exact" || relation === "new-covers") {
          // Trainer already satisfies the new schedule — no action needed
          continue
        }
        if (relation === "trainer-covers") {
          // Trainer covers more than new schedule — clamp to new range
          adapt.push(t)
          continue
        }
      }

      // Partial coverage — unassign from affected days
      const remaining = t.schedules
        .filter((s) => !oldDays.has(s.weekDay))
        .map((s) => ({ weekDay: s.weekDay, startTime: s.startTime, endTime: s.endTime }))
      unassign.push({ trainer: t, remainingSchedules: remaining })
    }

    if (unassign.length > 0) {
      setPendingScheduleEdit({
        scheduleId: oldSchedule.id,
        newData: { ...editScheduleForm },
        autoReassign,
        adapt,
        unassign,
      })
      return
    }

    await executeScheduleEdit(oldSchedule.id, editScheduleForm, autoReassign, adapt, [])
  }

  async function executeScheduleEdit(
    scheduleId: string,
    newData: NewScheduleForm,
    autoReassign: AssignedTrainer[],
    adapt: AssignedTrainer[],
    unassign: { trainer: AssignedTrainer; remainingSchedules: { weekDay: DayOfWeek; startTime: string; endTime: string }[] }[],
  ) {
    setEditScheduleSubmitting(true)

    const res = await fetch(`/api/schedules/${scheduleId}?gymId=${gymId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekDays: newData.weekDays,
        startTime: newData.startTime,
        endTime: newData.endTime,
        startDate: new Date(newData.startDate).toISOString(),
      }),
    })

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setEditScheduleError(d?.error ?? "Error al editar el horario.")
      setEditScheduleSubmitting(false)
      return
    }

    const warnings: { name: string; reason: string }[] = []
    const oldSchedule = editingSchedule!
    const oldDays = new Set(oldSchedule.weekDays)

    // Helper: deduplicate schedule entries by day (last write wins — new entries override existing)
    function dedupeByDay(entries: { weekDay: DayOfWeek; startTime: string; endTime: string }[]) {
      const map = new Map<DayOfWeek, { weekDay: DayOfWeek; startTime: string; endTime: string }>()
      for (const e of entries) map.set(e.weekDay, e)
      return Array.from(map.values())
    }

    for (const t of autoReassign) {
      const kept = t.schedules
        .filter((s) => !oldDays.has(s.weekDay))
        .map((s) => ({ weekDay: s.weekDay, startTime: s.startTime, endTime: s.endTime }))

      for (const day of newData.weekDays) {
        kept.push({ weekDay: day, startTime: newData.startTime, endTime: newData.endTime })
      }

      await fetch(`/api/groups/${groupId}/trainers/${t.trainer.id}?gymId=${gymId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourlyRate: Number(t.hourlyRate), schedules: dedupeByDay(kept) }),
      })
    }

    // Adapt trainers: covered >= new schedule on affected days — clamp to new range
    for (const t of adapt) {
      const kept = t.schedules
        .filter((s) => !oldDays.has(s.weekDay))
        .map((s) => ({ weekDay: s.weekDay, startTime: s.startTime, endTime: s.endTime }))

      for (const day of newData.weekDays) {
        const existing = t.schedules.find((s) => s.weekDay === day)
        if (existing) {
          // Clamp: intersection of trainer range and new schedule range
          const clampedStart = Math.max(timeToMinutes(existing.startTime), timeToMinutes(newData.startTime))
          const clampedEnd = Math.min(timeToMinutes(existing.endTime), timeToMinutes(newData.endTime))
          kept.push({ weekDay: day, startTime: minutesToTime(clampedStart), endTime: minutesToTime(clampedEnd) })
        } else {
          kept.push({ weekDay: day, startTime: newData.startTime, endTime: newData.endTime })
        }
      }

      await fetch(`/api/groups/${groupId}/trainers/${t.trainer.id}?gymId=${gymId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourlyRate: Number(t.hourlyRate), schedules: dedupeByDay(kept) }),
      })
    }

    for (const { trainer: t, remainingSchedules } of unassign) {
      if (remainingSchedules.length === 0) {
        await fetch(`/api/groups/${groupId}/trainers/${t.trainer.id}?gymId=${gymId}`, { method: "DELETE" })
        warnings.push({
          name: t.trainer.name,
          reason: "No cubría el 100% de los horarios del grupo. Fue removido del grupo porque no tenía otros horarios asignados.",
        })
      } else {
        await fetch(`/api/groups/${groupId}/trainers/${t.trainer.id}?gymId=${gymId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hourlyRate: Number(t.hourlyRate), schedules: remainingSchedules }),
        })
        const removedDayNames = oldSchedule.weekDays
          .filter((d) => t.schedules.some((s) => s.weekDay === d))
          .map((d) => DAY_SHORT[d])
          .join(", ")
        warnings.push({
          name: t.trainer.name,
          reason: `No cubría el 100% de los horarios del grupo. Fue desasignado de: ${removedDayNames}. Deberás reasignarlo manualmente.`,
        })
      }
    }

    setEditingSchedule(null)
    setEditScheduleForm(EMPTY_SCHEDULE)
    setEditScheduleSubmitting(false)
    setPendingScheduleEdit(null)

    if (warnings.length > 0) {
      setUnassignedWarning(warnings)
    }

    await onRefresh()
  }

  async function handleAddSchedule(e: React.FormEvent) {
    e.preventDefault(); setScheduleFormError(null)
    if (scheduleForm.weekDays.length === 0) { setScheduleFormError("Seleccioná al menos un día."); return }
    if (!scheduleForm.startTime) { setScheduleFormError("La hora de inicio es obligatoria."); return }
    if (!scheduleForm.endTime) { setScheduleFormError("La hora de fin es obligatoria."); return }
    if (!scheduleForm.startDate) { setScheduleFormError("La fecha de inicio es obligatoria."); return }

    setScheduleSubmitting(true)
    const res = await fetch(`/api/schedules?gymId=${gymId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, weekDays: scheduleForm.weekDays, startTime: scheduleForm.startTime, endTime: scheduleForm.endTime, startDate: new Date(scheduleForm.startDate).toISOString() }),
    })
    if (res.ok) { setScheduleForm(EMPTY_SCHEDULE); setShowScheduleForm(false); await onRefresh() }
    else { const d = await res.json().catch(() => ({})); setScheduleFormError(d?.error ?? "Error al agregar el horario.") }
    setScheduleSubmitting(false)
  }

  async function handleDeleteSchedule(scheduleId: string) {
    setDeletingId(scheduleId)
    const res = await fetch(`/api/schedules/${scheduleId}?gymId=${gymId}`, { method: "DELETE" })
    if (res.ok) await onRefresh()
    setDeletingId(null)
  }

  return (
    <>
      {/* ── Group info card ── */}
      <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-5 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#111110]">Información del grupo</p>
          <Button onClick={startEdit}>Editar</Button>
        </div>

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
      </div>

      {/* ── Schedules section ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-[#111110]">Horarios</p>
          <Button onClick={() => { setShowScheduleForm(true); setScheduleFormError(null); setScheduleForm(EMPTY_SCHEDULE) }}>+ Agregar horario</Button>
        </div>

        {unassignedWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-amber-900">Entrenadores desasignados</p>
              <button onClick={() => setUnassignedWarning(null)} className="cursor-pointer text-xs text-amber-700 hover:text-amber-900">Cerrar</button>
            </div>
            {unassignedWarning.map((w, i) => (
              <p key={i} className="text-xs text-amber-700"><span className="font-medium">{w.name}:</span> {w.reason}</p>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-[#E5E4E0] bg-white overflow-hidden">
          {group.schedules.length === 0 ? (
            <div className="py-16 text-center"><p className="text-sm text-[#68685F]">No hay horarios configurados.</p></div>
          ) : (
            <div className="divide-y divide-[#F0EFEB]">
              {group.schedules.map((s) => (
                <div key={s.id} className="px-5 py-4 hover:bg-[#FAFAF9] transition-colors space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {s.weekDays.map((d) => (
                          <span key={d} className="rounded-md bg-[#F0EFEB] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#68685F]">{DAY_SHORT[d]}</span>
                        ))}
                      </div>
                      <p className="text-sm text-[#111110] font-medium">{s.startTime} – {s.endTime}</p>
                      <p className="text-xs text-[#A5A49D]">Desde {new Date(s.startDate).toLocaleDateString("es-AR")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button onClick={() => startEditSchedule(s)}>Editar</Button>
                      <Button variant="danger" onClick={() => setConfirmScheduleId(s.id)} disabled={deletingId === s.id}>
                        {deletingId === s.id ? "…" : "Eliminar"}
                      </Button>
                    </div>
                  </div>
                  {/* Cobertura por día de este horario */}
                  <div className="flex flex-wrap gap-2">
                    {s.weekDays.map((d) => {
                      const trainerEntries = group.trainers.flatMap((t) =>
                        t.schedules.filter((ts) => ts.weekDay === d)
                      )
                      const { fullyСovered } = computeCoverage(s.startTime, s.endTime, trainerEntries)
                      const trainersOnDay = group.trainers
                        .filter((t) => t.schedules.some((ts) => ts.weekDay === d))
                        .map((t) => t.trainer.name)

                      return (
                        <div key={d} className="flex items-center gap-1.5 rounded-md border border-[#E5E4E0] px-2 py-1">
                          <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            fullyСovered ? "bg-emerald-500" : trainerEntries.length > 0 ? "bg-amber-400" : "bg-red-400"
                          }`} />
                          <span className="text-[11px] font-medium text-[#111110]">{DAY_SHORT[d]}</span>
                          <span className="text-[10px] text-[#A5A49D]">
                            {trainersOnDay.length > 0 ? trainersOnDay.join(", ") : "sin entrenador"}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit group modal ── */}
      <FormModal
        open={showEditModal}
        title="Editar grupo"
        error={editError}
        onSubmit={handleSave}
        submitting={submitting}
        onCancel={() => { setShowEditModal(false); setEditError(null) }}
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

      {/* ── Add schedule modal ── */}
      <FormModal
        open={showScheduleForm}
        title="Nuevo horario"
        error={scheduleFormError}
        onSubmit={handleAddSchedule}
        submitting={scheduleSubmitting}
        onCancel={() => { setShowScheduleForm(false); setScheduleForm(EMPTY_SCHEDULE); setScheduleFormError(null) }}
        gridCols="sm:grid-cols-3"
      >
        <div className="sm:col-span-3 flex flex-col gap-1.5">
          <Label>Días *</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const checked = scheduleForm.weekDays.includes(d.value)
              return (
                <button key={d.value} type="button" onClick={() => toggleDay(d.value)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    checked ? "bg-[#111110] text-white" : "border border-[#E5E4E0] text-[#68685F] hover:bg-[#F0EFEB] hover:text-[#111110]"
                  }`}
                >{d.short}</button>
              )
            })}
          </div>
        </div>
        <FormField label="Hora inicio" required>
          <Input type="time" value={scheduleForm.startTime} onChange={(e) => setScheduleForm((f) => ({ ...f, startTime: e.target.value }))} />
        </FormField>
        <FormField label="Hora fin" required>
          <Input type="time" value={scheduleForm.endTime} onChange={(e) => setScheduleForm((f) => ({ ...f, endTime: e.target.value }))} />
        </FormField>
        <FormField label="Fecha inicio" required>
          <Input type="date" value={scheduleForm.startDate} onChange={(e) => setScheduleForm((f) => ({ ...f, startDate: e.target.value }))} />
        </FormField>
      </FormModal>

      {/* ── Edit schedule modal ── */}
      <FormModal
        open={editingSchedule !== null}
        title="Editar horario"
        error={editScheduleError}
        onSubmit={handleEditScheduleSubmit}
        submitting={editScheduleSubmitting}
        onCancel={() => { setEditingSchedule(null); setEditScheduleForm(EMPTY_SCHEDULE); setEditScheduleError(null) }}
        gridCols="sm:grid-cols-3"
      >
        <div className="sm:col-span-3 flex flex-col gap-1.5">
          <Label>Días *</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => {
              const checked = editScheduleForm.weekDays.includes(d.value)
              return (
                <button key={d.value} type="button" onClick={() => toggleEditDay(d.value)}
                  className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                    checked ? "bg-[#111110] text-white" : "border border-[#E5E4E0] text-[#68685F] hover:bg-[#F0EFEB] hover:text-[#111110]"
                  }`}
                >{d.short}</button>
              )
            })}
          </div>
        </div>
        <FormField label="Hora inicio" required>
          <Input type="time" value={editScheduleForm.startTime} onChange={(e) => setEditScheduleForm((f) => ({ ...f, startTime: e.target.value }))} />
        </FormField>
        <FormField label="Hora fin" required>
          <Input type="time" value={editScheduleForm.endTime} onChange={(e) => setEditScheduleForm((f) => ({ ...f, endTime: e.target.value }))} />
        </FormField>
        <FormField label="Fecha inicio" required>
          <Input type="date" value={editScheduleForm.startDate} onChange={(e) => setEditScheduleForm((f) => ({ ...f, startDate: e.target.value }))} />
        </FormField>
      </FormModal>

      {/* ── Confirm delete schedule dialog ── */}
      <ConfirmDialog
        open={confirmScheduleId !== null}
        title="Eliminar horario"
        message="Esta acción no se puede deshacer. El horario se eliminará permanentemente."
        confirmLabel="Eliminar"
        onConfirm={() => { const id = confirmScheduleId!; setConfirmScheduleId(null); handleDeleteSchedule(id) }}
        onCancel={() => setConfirmScheduleId(null)}
      />

      {/* ── Pending trainer reassignment confirmation ── */}
      {pendingScheduleEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
          <div className="relative w-full max-w-md rounded-2xl border border-[#E5E4E0] bg-white px-6 py-6 shadow-xl space-y-4">
            <p className="text-[15px] font-semibold text-[#111110]">Entrenadores afectados</p>
            <p className="text-sm text-[#68685F]">
              Los siguientes entrenadores no cubren el 100% de los horarios del grupo y serán desasignados de los días afectados:
            </p>
            <ul className="space-y-2">
              {pendingScheduleEdit.unassign.map(({ trainer: t, remainingSchedules }) => (
                <li key={t.id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-sm font-medium text-amber-900">{t.trainer.name}</p>
                  <p className="text-xs text-amber-700">
                    {remainingSchedules.length === 0
                      ? "Será removido del grupo (no tiene otros horarios asignados)."
                      : `Será desasignado de: ${editingSchedule!.weekDays.filter((d) => t.schedules.some((s) => s.weekDay === d)).map((d) => DAY_SHORT[d]).join(", ")}`
                    }
                  </p>
                </li>
              ))}
            </ul>
            <p className="text-xs text-[#68685F]">Deberás reasignarlos manualmente después de confirmar.</p>
            <div className="flex items-center justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={() => setPendingScheduleEdit(null)}>Cancelar</Button>
              <Button
                onClick={() => executeScheduleEdit(
                  pendingScheduleEdit.scheduleId,
                  pendingScheduleEdit.newData,
                  pendingScheduleEdit.autoReassign,
                  pendingScheduleEdit.adapt,
                  pendingScheduleEdit.unassign,
                )}
                disabled={editScheduleSubmitting}
              >
                {editScheduleSubmitting ? "Guardando…" : "Confirmar y editar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
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
  const [confirmStudentId, setConfirmStudentId] = useState<string | null>(null)
  const [paidCount, setPaidCount] = useState<number | null>(null)

  const enrolledIds = new Set(group.students.map((s) => s.student.id))

  // Fetch payment status for current period to count paid students in this group
  useEffect(() => {
    const controller = new AbortController()
    const now = new Date()
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    fetch(`/api/payments?gymId=${gymId}&period=${period}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : [])
      .then((payments: { studentId: string; status: string }[]) => {
        const groupStudentIds = new Set(group.students.map((s) => s.student.id))
        const paid = payments.filter((p) => groupStudentIds.has(p.studentId) && p.status === "PAID").length
        setPaidCount(paid)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return
        setPaidCount(null)
      })
    return () => controller.abort()
  }, [gymId, group.students])

  async function loadGymStudents() {
    setLoadingPicker(true)
    try {
      const res = await fetch(`/api/students?gymId=${gymId}`)
      if (res.ok) {
        const data: GymStudent[] = await res.json()
        setGymStudents(data.filter((s) => !enrolledIds.has(s.id)))
      }
    } catch {
      // silently fail — picker simply stays empty
    } finally {
      setLoadingPicker(false)
    }
  }

  function handleShowPicker() {
    setShowPicker(true); setEnrollError(null); setSelectedStudentId(""); loadGymStudents()
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault()
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

      <FormModal
        open={showPicker}
        title="Inscribir alumno"
        error={enrollError}
        onSubmit={handleEnroll}
        submitting={enrolling}
        onCancel={() => { setShowPicker(false); setEnrollError(null) }}
        gridCols="sm:grid-cols-1"
      >
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
      </FormModal>

      {/* Quick stats */}
      {group.students.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-[#E5E4E0] bg-white px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Ocupación</span>
            <span className="text-sm font-mono font-medium text-[#111110]">
              {group.students.length}{group.maxCapacity != null ? `/${group.maxCapacity}` : ""}
            </span>
            {group.maxCapacity != null && (
              <span className={`text-xs font-medium ${group.students.length >= group.maxCapacity ? "text-red-600" : group.students.length >= group.maxCapacity * 0.8 ? "text-amber-600" : "text-emerald-600"}`}>
                ({Math.round((group.students.length / group.maxCapacity) * 100)}%)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#E5E4E0] bg-white px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Cuota del mes</span>
            {paidCount !== null ? (
              <>
                <span className="text-sm font-mono font-medium text-[#111110]">{paidCount}/{group.students.length}</span>
                <span className={`text-xs font-medium ${paidCount === group.students.length ? "text-emerald-600" : paidCount > 0 ? "text-amber-600" : "text-red-600"}`}>
                  pagaron
                </span>
              </>
            ) : (
              <span className="text-xs text-[#A5A49D]">…</span>
            )}
          </div>
        </div>
      )}

      <DataTable
        columns={[
          { key: "name", header: "Alumno", render: (e: EnrolledStudent) => <span className="font-medium text-[#111110]">{e.student.firstName} {e.student.lastName}</span> },
          { key: "enrolledAt", header: "Inscripto el", render: (e: EnrolledStudent) => <span className="text-[#68685F]">{new Date(e.enrolledAt).toLocaleDateString("es-AR")}</span> },
          { key: "actions", header: "", align: "right" as const, render: (e: EnrolledStudent) => (
            <Button variant="danger" onClick={() => setConfirmStudentId(e.student.id)} disabled={unenrollingId === e.student.id}>
              {unenrollingId === e.student.id ? "…" : "Desinscribir"}
            </Button>
          )},
        ]}
        data={group.students}
        loading={false}
        emptyMessage="No hay alumnos inscriptos en este grupo."
        emptyHint="Usá el botón '+ Inscribir alumno' para agregar alumnos."
        minWidth="400px"
        rowKey={(e) => e.id}
      />

      <ConfirmDialog
        open={confirmStudentId !== null}
        title="Desinscribir alumno"
        message="Se quitará al alumno de este grupo. Podrás volver a inscribirlo cuando quieras."
        confirmLabel="Desinscribir"
        onConfirm={() => { const id = confirmStudentId!; setConfirmStudentId(null); handleUnenroll(id) }}
        onCancel={() => setConfirmStudentId(null)}
      />
    </div>
  )
}

// ─── TRAINERS TAB ─────────────────────────────────────────────────────────────

// Time helpers for coverage calculation
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

type CoverageGap = { start: number; end: number }

function computeCoverage(
  groupStart: string,
  groupEnd: string,
  trainerEntries: { startTime: string; endTime: string }[],
): { fullyСovered: boolean; gaps: CoverageGap[] } {
  const gStart = timeToMinutes(groupStart)
  const gEnd = timeToMinutes(groupEnd)

  // Collect and sort intervals that overlap with group range
  const intervals = trainerEntries
    .map((e) => ({ s: Math.max(timeToMinutes(e.startTime), gStart), e: Math.min(timeToMinutes(e.endTime), gEnd) }))
    .filter((i) => i.s < i.e)
    .sort((a, b) => a.s - b.s)

  const gaps: CoverageGap[] = []
  let cursor = gStart

  for (const iv of intervals) {
    if (iv.s > cursor) gaps.push({ start: cursor, end: iv.s })
    cursor = Math.max(cursor, iv.e)
  }
  if (cursor < gEnd) gaps.push({ start: cursor, end: gEnd })

  return { fullyСovered: gaps.length === 0, gaps }
}

// Trainer schedule form state
type TrainerDayEntry = { checked: boolean; startTime: string; endTime: string }
type TrainerFormState = { trainerId: string; hourlyRate: string; days: Partial<Record<DayOfWeek, TrainerDayEntry>> }

function buildEmptyTrainerForm(): TrainerFormState {
  return { trainerId: "", hourlyRate: "", days: {} }
}

function buildEditTrainerForm(assigned: AssignedTrainer): TrainerFormState {
  const days: Partial<Record<DayOfWeek, TrainerDayEntry>> = {}
  for (const s of assigned.schedules) {
    days[s.weekDay] = { checked: true, startTime: s.startTime, endTime: s.endTime }
  }
  return { trainerId: assigned.trainer.id, hourlyRate: assigned.hourlyRate, days }
}

// Sub-component: the assignment / edit form (content only — no buttons, used inside FormModal)
function TrainerAssignForm({
  gymTrainers,
  loadingTrainers,
  group,
  form,
  editMode,
  onFormChange,
}: {
  gymTrainers: GymTrainer[]
  loadingTrainers: boolean
  group: GroupDetail
  form: TrainerFormState
  editMode: boolean
  onFormChange: (form: TrainerFormState) => void
}) {
  function updateForm(updater: (prev: TrainerFormState) => TrainerFormState) {
    onFormChange(updater(form))
  }

  // Build a lookup: which days are in the group's schedules and their times
  const groupDayMap: Partial<Record<DayOfWeek, { startTime: string; endTime: string }>> = {}
  for (const s of group.schedules) {
    for (const d of s.weekDays) {
      // If a day appears in multiple schedules, last write wins — acceptable
      groupDayMap[d] = { startTime: s.startTime, endTime: s.endTime }
    }
  }
  const groupDays = DAYS.filter((d) => groupDayMap[d.value] !== undefined)

  function toggleDay(day: DayOfWeek) {
    updateForm((f) => {
      const current = f.days[day]
      if (current?.checked) {
        const next = { ...f.days }
        delete next[day]
        return { ...f, days: next }
      }
      const groupTimes = groupDayMap[day]
      return {
        ...f,
        days: {
          ...f.days,
          [day]: { checked: true, startTime: groupTimes?.startTime ?? "", endTime: groupTimes?.endTime ?? "" },
        },
      }
    })
  }

  function updateDayTime(day: DayOfWeek, field: "startTime" | "endTime", value: string) {
    updateForm((f) => ({
      ...f,
      days: { ...f.days, [day]: { ...(f.days[day] ?? { checked: true, startTime: "", endTime: "" }), [field]: value } },
    }))
  }

  function coverAll() {
    const next: Partial<Record<DayOfWeek, TrainerDayEntry>> = {}
    for (const d of groupDays) {
      const times = groupDayMap[d.value]!
      next[d.value] = { checked: true, startTime: times.startTime, endTime: times.endTime }
    }
    updateForm((f) => ({ ...f, days: next }))
  }

  return (
    <div className="space-y-5">
      {loadingTrainers ? (
        <p className="text-sm text-[#A5A49D]">Cargando entrenadores…</p>
      ) : (
        <div className="space-y-5">
          {/* Row 1: Trainer select + hourlyRate */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!editMode && (
              <FormField label="Entrenador" required>
                <Select value={form.trainerId} onChange={(e) => updateForm((f) => ({ ...f, trainerId: e.target.value }))}>
                  <option value="">Seleccioná un entrenador…</option>
                  {gymTrainers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
              </FormField>
            )}
            <FormField label="Tarifa por hora" required>
              <NumberInput
                value={form.hourlyRate}
                onChange={(e) => updateForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                placeholder="Ej: 2000"
              />
            </FormField>
          </div>

          {/* Row 2: Day picker */}
          {groupDays.length === 0 ? (
            <p className="text-sm text-[#68685F]">Este grupo no tiene horarios configurados. Agregá horarios primero.</p>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label>Horarios del entrenador *</Label>
                <button
                  type="button"
                  onClick={coverAll}
                  className="cursor-pointer self-start rounded-md border border-[#E5E4E0] px-3 py-1.5 text-xs font-medium text-[#68685F] hover:bg-[#F0EFEB] hover:text-[#111110] transition-colors sm:self-auto"
                >
                  Cubrir todo el grupo
                </button>
              </div>

              <div className="space-y-2">
                {groupDays.map((d) => {
                  const entry = form.days[d.value]
                  const checked = entry?.checked ?? false
                  const groupTimes = groupDayMap[d.value]!
                  return (
                    <div key={d.value} className="rounded-lg border border-[#E5E4E0] px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        {/* Checkbox + day label */}
                        <label className="flex min-w-[90px] cursor-pointer items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleDay(d.value)}
                            className="h-4 w-4 rounded border-[#E5E4E0] accent-[#111110]"
                          />
                          <span className={`text-sm font-semibold ${checked ? "text-[#111110]" : "text-[#A5A49D]"}`}>
                            {d.short}
                          </span>
                          <span className="text-xs text-[#A5A49D]">
                            ({groupTimes.startTime}–{groupTimes.endTime})
                          </span>
                        </label>

                        {/* Time inputs — only when checked */}
                        {checked && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={entry?.startTime ?? ""}
                              onChange={(e) => updateDayTime(d.value, "startTime", e.target.value)}
                              className="w-[120px]"
                            />
                            <span className="text-xs text-[#A5A49D]">a</span>
                            <Input
                              type="time"
                              value={entry?.endTime ?? ""}
                              onChange={(e) => updateDayTime(d.value, "endTime", e.target.value)}
                              className="w-[120px]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

type ScheduleConflict = {
  weekDay: string; newTime: string; existingTime: string; groupName: string
}

function TrainersTab({ group, gymId, groupId, onRefresh }: SubTabProps) {
  const [gymTrainers, setGymTrainers] = useState<GymTrainer[]>([])
  const [loadingPicker, setLoadingPicker] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignError, setAssignError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [confirmTrainerId, setConfirmTrainerId] = useState<string | null>(null)

  // Edit modal state
  const [editingTrainer, setEditingTrainer] = useState<AssignedTrainer | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Overlap conflict state
  const [overlapConflicts, setOverlapConflicts] = useState<ScheduleConflict[]>([])
  const [pendingOverlapAction, setPendingOverlapAction] = useState<"assign" | "edit" | null>(null)

  // Track current form state from TrainerAssignForm children
  const [assignFormCurrent, setAssignFormCurrent] = useState<TrainerFormState>(buildEmptyTrainerForm())
  const [editFormCurrent, setEditFormCurrent] = useState<TrainerFormState>(buildEmptyTrainerForm())

  const assignedIds = new Set(group.trainers.map((t) => t.trainer.id))

  async function loadGymTrainers() {
    setLoadingPicker(true)
    try {
      const res = await fetch(`/api/trainers?gymId=${gymId}`)
      if (res.ok) {
        const data: GymTrainer[] = await res.json()
        setGymTrainers(data.filter((t) => !assignedIds.has(t.id)))
      }
    } catch {
      // silently fail — picker simply stays empty
    } finally {
      setLoadingPicker(false)
    }
  }

  function handleShowAssignForm() {
    const empty = buildEmptyTrainerForm()
    setAssignFormCurrent(empty)
    setAssignError(null)
    setShowForm(true)
    loadGymTrainers()
  }

  function handleShowEditForm(trainer: AssignedTrainer) {
    const initial = buildEditTrainerForm(trainer)
    setEditingTrainer(trainer)
    setEditFormCurrent(initial)
    setEditError(null)
    setShowEditModal(true)
  }

  function buildSchedulesPayload(days: Partial<Record<DayOfWeek, TrainerDayEntry>>) {
    return Object.entries(days)
      .filter(([, entry]) => entry?.checked)
      .map(([day, entry]) => ({
        weekDay: day as DayOfWeek,
        startTime: entry!.startTime,
        endTime: entry!.endTime,
      }))
  }

  function validateForm(form: TrainerFormState, requireTrainer: boolean): string | null {
    if (requireTrainer && !form.trainerId) return "Seleccioná un entrenador."
    if (!form.hourlyRate || Number(form.hourlyRate) <= 0) return "La tarifa por hora es obligatoria y debe ser mayor a 0."
    const schedules = buildSchedulesPayload(form.days)
    if (schedules.length === 0) return "Seleccioná al menos un día."
    for (const s of schedules) {
      if (!s.startTime) return `Falta la hora de inicio para ${DAY_SHORT[s.weekDay]}.`
      if (!s.endTime) return `Falta la hora de fin para ${DAY_SHORT[s.weekDay]}.`
      if (timeToMinutes(s.startTime) >= timeToMinutes(s.endTime))
        return `La hora de inicio debe ser anterior a la de fin para ${DAY_SHORT[s.weekDay]}.`
    }
    return null
  }

  async function handleAssign(e: React.FormEvent, forceOverlap = false) {
    e.preventDefault()
    setAssignError(null)
    const err = validateForm(assignFormCurrent, true)
    if (err) { setAssignError(err); return }

    setAssigning(true)
    try {
      const body = {
        trainerId: assignFormCurrent.trainerId,
        hourlyRate: Number(assignFormCurrent.hourlyRate),
        schedules: buildSchedulesPayload(assignFormCurrent.days),
        ...(forceOverlap && { forceOverlap: true }),
      }
      const res = await fetch(`/api/groups/${groupId}/trainers?gymId=${gymId}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (res.ok) { setShowForm(false); setOverlapConflicts([]); setPendingOverlapAction(null); await onRefresh() }
      else {
        const d = await res.json().catch(() => ({}))
        if (res.status === 409 && d.conflicts) {
          setOverlapConflicts(d.conflicts)
          setPendingOverlapAction("assign")
        } else {
          setAssignError(d?.error ?? "Error al asignar el entrenador.")
        }
      }
    } catch { setAssignError("Error de red.") }
    finally { setAssigning(false) }
  }

  async function handleEdit(e: React.FormEvent, forceOverlap = false) {
    e.preventDefault()
    if (!editingTrainer) return
    setEditError(null)
    const err = validateForm(editFormCurrent, false)
    if (err) { setEditError(err); return }

    setAssigning(true)
    try {
      const body = {
        hourlyRate: Number(editFormCurrent.hourlyRate),
        schedules: buildSchedulesPayload(editFormCurrent.days),
        ...(forceOverlap && { forceOverlap: true }),
      }
      const res = await fetch(`/api/groups/${groupId}/trainers/${editingTrainer.trainer.id}?gymId=${gymId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      })
      if (res.ok) { setShowEditModal(false); setEditingTrainer(null); setOverlapConflicts([]); setPendingOverlapAction(null); await onRefresh() }
      else {
        const d = await res.json().catch(() => ({}))
        if (res.status === 409 && d.conflicts) {
          setOverlapConflicts(d.conflicts)
          setPendingOverlapAction("edit")
        } else {
          setEditError(typeof d?.error === "string" ? d.error : "Error al actualizar el entrenador.")
        }
      }
    } catch { setEditError("Error de red.") }
    finally { setAssigning(false) }
  }

  function handleForceOverlap() {
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent
    if (pendingOverlapAction === "assign") handleAssign(fakeEvent, true)
    else if (pendingOverlapAction === "edit") handleEdit(fakeEvent, true)
  }

  function dismissOverlap() {
    setOverlapConflicts([])
    setPendingOverlapAction(null)
  }

  async function handleRemove(trainerId: string) {
    setRemovingId(trainerId)
    const res = await fetch(`/api/groups/${groupId}/trainers/${trainerId}?gymId=${gymId}`, { method: "DELETE" })
    if (res.ok) await onRefresh()
    setRemovingId(null)
  }

  // Build a lookup: which days are in the group's schedules and their times
  const groupDayMap: Partial<Record<DayOfWeek, { startTime: string; endTime: string }>> = {}
  for (const s of group.schedules) {
    for (const d of s.weekDays) {
      groupDayMap[d] = { startTime: s.startTime, endTime: s.endTime }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-[#111110]">
          Entrenadores asignados <span className="ml-2 text-xs font-normal text-[#A5A49D]">({group.trainers.length})</span>
        </p>
        <Button onClick={handleShowAssignForm}>+ Asignar entrenador</Button>
      </div>

      {/* Assign modal */}
      <FormModal
        open={showForm}
        title="Asignar entrenador"
        error={assignError}
        onSubmit={handleAssign}
        submitting={assigning}
        onCancel={() => { setShowForm(false); setAssignError(null) }}
        gridCols="sm:grid-cols-1"
      >
        <TrainerAssignForm
          gymTrainers={gymTrainers}
          loadingTrainers={loadingPicker}
          group={group}
          form={assignFormCurrent}
          editMode={false}
          onFormChange={setAssignFormCurrent}
        />
      </FormModal>

      {/* Edit modal */}
      <FormModal
        open={showEditModal}
        title={editingTrainer ? `Editar: ${editingTrainer.trainer.name}` : "Editar asignación"}
        error={editError}
        onSubmit={handleEdit}
        submitting={assigning}
        onCancel={() => { setShowEditModal(false); setEditingTrainer(null); setEditError(null) }}
        gridCols="sm:grid-cols-1"
      >
        {editingTrainer && (
          <TrainerAssignForm
            gymTrainers={[]}
            loadingTrainers={false}
            group={group}
            form={editFormCurrent}
            editMode={true}
            onFormChange={setEditFormCurrent}
          />
        )}
      </FormModal>

      {/* Overlap conflict dialog */}
      {overlapConflicts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#111110]">Horarios superpuestos</h3>
                <p className="mt-1 text-xs text-[#68685F]">El profesor ya tiene horarios asignados que se superponen con los nuevos:</p>
              </div>
            </div>
            <div className="space-y-2">
              {overlapConflicts.map((c, i) => (
                <div key={i} className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs">
                  <p className="font-semibold text-amber-800">{c.weekDay}</p>
                  <p className="text-amber-700">
                    Nuevo: <span className="font-mono">{c.newTime}</span>
                    {" — "}
                    Existente: <span className="font-mono">{c.existingTime}</span> en <span className="font-semibold">{c.groupName}</span>
                  </p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={dismissOverlap}
                className="cursor-pointer rounded-lg border border-[#E5E4E0] px-4 py-2 text-sm text-[#68685F] hover:bg-[#F7F6F3] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleForceOverlap}
                disabled={assigning}
                className="cursor-pointer rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {assigning ? "Asignando..." : "Asignar de todas formas"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assigned trainers table */}
      <div className="overflow-x-auto rounded-xl border border-[#E5E4E0] bg-white">
        {group.trainers.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-[#68685F]">No hay entrenadores asignados a este grupo.</p>
            <p className="mt-1 text-xs text-[#A5A49D]">Usá el botón &apos;+ Asignar entrenador&apos; para agregar uno.</p>
          </div>
        ) : (
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[#F0EFEB]">
                <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Nombre</th>
                <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Tarifa</th>
                <th className="px-4 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Horarios</th>
                <th className="px-4 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]"></th>
              </tr>
            </thead>
            <tbody>
              {group.trainers.map((t, i) => (
                <tr
                  key={t.id}
                  className={`hover:bg-[#FAFAF9] transition-colors ${i > 0 ? "border-t border-[#F7F6F3]" : ""}`}
                >
                  <td className="px-4 py-3.5">
                    <span className="font-medium text-[#111110]">{t.trainer.name}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-[#68685F]">
                      ${Number(t.hourlyRate).toLocaleString("es-AR")}/h
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1.5">
                      {t.schedules.length === 0 ? (
                        <span className="text-xs text-[#A5A49D]">Sin horarios</span>
                      ) : (
                        t.schedules.map((s) => (
                          <span
                            key={s.id}
                            className="rounded-md bg-[#F0EFEB] px-2 py-0.5 text-[11px] font-medium text-[#68685F]"
                          >
                            {DAY_SHORT[s.weekDay]} {s.startTime}–{s.endTime}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleShowEditForm(t)}
                        className="cursor-pointer min-h-[36px] rounded-lg border border-[#E5E4E0] bg-white px-3 py-1.5 text-xs font-medium text-[#68685F] hover:text-[#111110] transition-colors"
                      >
                        Editar
                      </button>
                      <Button
                        variant="danger"
                        onClick={() => setConfirmTrainerId(t.trainer.id)}
                        disabled={removingId === t.trainer.id}
                      >
                        {removingId === t.trainer.id ? "…" : "Remover"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Coverage indicator */}
      {Object.keys(groupDayMap).length > 0 && (
        <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Cobertura por día</p>
            {(() => {
              const days = DAYS.filter((d) => groupDayMap[d.value])
              const allFull = days.every((d) => {
                const entries = group.trainers.flatMap((t) => t.schedules.filter((s) => s.weekDay === d.value))
                return computeCoverage(groupDayMap[d.value]!.startTime, groupDayMap[d.value]!.endTime, entries).fullyСovered
              })
              const anyTrainer = group.trainers.length > 0
              return (
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  allFull && anyTrainer ? "bg-emerald-50 text-emerald-700" :
                  anyTrainer ? "bg-amber-50 text-amber-700" :
                  "bg-red-50 text-red-700"
                }`}>
                  {allFull && anyTrainer ? "100% cubierto" : anyTrainer ? "Cobertura parcial" : "Sin cobertura"}
                </span>
              )
            })()}
          </div>
          <div className="space-y-5">
            {DAYS.filter((d) => groupDayMap[d.value]).map((d) => {
              const groupTimes = groupDayMap[d.value]!
              const gStart = timeToMinutes(groupTimes.startTime)
              const gEnd = timeToMinutes(groupTimes.endTime)
              const totalMinutes = gEnd - gStart

              const trainerEntries = group.trainers.map((t) => ({
                name: t.trainer.name,
                entries: t.schedules.filter((s) => s.weekDay === d.value),
              })).filter((t) => t.entries.length > 0)

              const allEntries = trainerEntries.flatMap((t) => t.entries)
              const { fullyСovered, gaps } = computeCoverage(groupTimes.startTime, groupTimes.endTime, allEntries)

              return (
                <div key={d.value} className="space-y-2">
                  {/* Day header */}
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 shrink-0 rounded-full ${
                      fullyСovered ? "bg-emerald-500" : trainerEntries.length > 0 ? "bg-amber-400" : "bg-red-400"
                    }`} />
                    <span className="text-sm font-semibold text-[#111110]">{d.label}</span>
                    <span className="text-xs text-[#A5A49D]">{groupTimes.startTime}–{groupTimes.endTime}</span>
                  </div>

                  {/* Per-trainer timeline bars */}
                  <div className="ml-4 space-y-1">
                    {/* Time axis labels */}
                    <div className="flex items-center justify-between px-0.5">
                      <span className="text-[9px] font-mono text-[#A5A49D]">{groupTimes.startTime}</span>
                      <span className="text-[9px] font-mono text-[#A5A49D]">{groupTimes.endTime}</span>
                    </div>

                    {trainerEntries.length > 0 ? (
                      <>
                        {/* One bar per trainer */}
                        {trainerEntries.map((t) => (
                          <div key={t.name} className="flex items-center gap-2">
                            <span className="w-[80px] shrink-0 truncate text-[11px] font-medium text-[#111110]" title={t.name}>{t.name}</span>
                            <div className="relative h-7 flex-1 rounded bg-[#F0EFEB] overflow-hidden">
                              {t.entries.map((e, i) => {
                                const eStart = Math.max(timeToMinutes(e.startTime), gStart)
                                const eEnd = Math.min(timeToMinutes(e.endTime), gEnd)
                                if (eStart >= eEnd) return null
                                const left = ((eStart - gStart) / totalMinutes) * 100
                                const width = ((eEnd - eStart) / totalMinutes) * 100
                                return (
                                  <div
                                    key={i}
                                    className="absolute top-0 h-full rounded bg-emerald-400/70 flex items-center justify-between px-1.5"
                                    style={{ left: `${left}%`, width: `${width}%` }}
                                    title={`${e.startTime}–${e.endTime}`}
                                  >
                                    <span className="text-[10px] font-mono font-bold text-emerald-900">{e.startTime}</span>
                                    <span className="text-[10px] font-mono font-bold text-emerald-900">{e.endTime}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}

                        {/* Gap bar — only if there are uncovered segments */}
                        {gaps.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="w-[80px] shrink-0 text-[11px] font-medium text-red-600">Sin cubrir</span>
                            <div className="relative h-7 flex-1 rounded bg-[#F0EFEB] overflow-hidden">
                              {gaps.map((g, i) => {
                                const left = ((g.start - gStart) / totalMinutes) * 100
                                const width = ((g.end - g.start) / totalMinutes) * 100
                                return (
                                  <div
                                    key={i}
                                    className="absolute top-0 h-full rounded bg-red-300/50 flex items-center justify-between px-1.5"
                                    style={{ left: `${left}%`, width: `${width}%` }}
                                    title={`${minutesToTime(g.start)}–${minutesToTime(g.end)}`}
                                  >
                                    <span className="text-[10px] font-mono font-bold text-red-800">{minutesToTime(g.start)}</span>
                                    <span className="text-[10px] font-mono font-bold text-red-800">{minutesToTime(g.end)}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="w-[80px] shrink-0 text-[11px] font-medium text-red-600">Sin cubrir</span>
                        <div className="relative h-7 flex-1 rounded bg-red-300/50 overflow-hidden flex items-center justify-between px-1.5">
                          <span className="text-[10px] font-mono font-bold text-red-800">{groupTimes.startTime}</span>
                          <span className="text-[10px] font-mono font-bold text-red-800">{groupTimes.endTime}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmTrainerId !== null}
        title="Remover entrenador"
        message="Se quitará al entrenador de este grupo. Podrás volver a asignarlo cuando quieras."
        confirmLabel="Remover"
        onConfirm={() => { const id = confirmTrainerId!; setConfirmTrainerId(null); handleRemove(id) }}
        onCancel={() => setConfirmTrainerId(null)}
      />
    </div>
  )
}
