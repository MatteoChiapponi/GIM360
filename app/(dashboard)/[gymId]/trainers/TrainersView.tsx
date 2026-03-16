"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useFetch } from "@/hooks/useFetch"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { FormField } from "@/components/ui/FormField"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchToolbar } from "@/components/ui/SearchToolbar"
import { DataTable } from "@/components/ui/DataTable"
import { FormModal } from "@/components/ui/FormModal"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

// ─── Types ──────────────────────────────────────────────────────────────────

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
  groups: TrainerGroupAssignment[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────

export default function TrainersView({ gymId }: { gymId: string }) {
  const { data: trainers, loading, error, refetch } = useFetch<Trainer[]>(
    `/api/trainers?gymId=${gymId}`, [], "No se pudieron cargar los entrenadores.",
  )
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<{ name: string }>({ name: "" })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedTrainer = trainers.find((t) => t.id === selectedId) ?? null

  // Edit state (inside detail)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<{ name: string }>({ name: "" })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Deactivate
  const [confirmId, setConfirmId] = useState<string | null>(null)

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) { setFormError("El nombre es obligatorio."); return }
    setSubmitting(true)
    const res = await fetch("/api/trainers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gymId, name: form.name.trim() }),
    })
    if (res.ok) { setForm({ name: "" }); setShowForm(false); await refetch() }
    else { const d = await res.json().catch(() => ({})); setFormError(d?.error ?? "Error al crear el entrenador.") }
    setSubmitting(false)
  }

  function openDetail(t: Trainer) {
    setSelectedId(t.id)
    setEditing(false)
    setEditError(null)
  }

  function closeDetail() {
    setSelectedId(null)
    setEditing(false)
    setEditError(null)
  }

  function startEdit() {
    if (!selectedTrainer) return
    setEditForm({ name: selectedTrainer.name })
    setEditing(true)
    setEditError(null)
  }

  async function handleSaveEdit() {
    if (!selectedTrainer) return
    setEditError(null)
    if (!editForm.name.trim()) { setEditError("El nombre es obligatorio."); return }
    setEditSubmitting(true)
    const res = await fetch(`/api/trainers/${selectedTrainer.id}?gymId=${gymId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name.trim() }),
    })
    if (res.ok) { setEditing(false); await refetch() }
    else { const d = await res.json().catch(() => ({})); setEditError(d?.error ?? "Error al actualizar.") }
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Costo mensual est.</p>
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
        onCancel={() => { setShowForm(false); setForm({ name: "" }); setFormError(null) }}
      >
        <FormField label="Nombre" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Carlos López" />
        </FormField>
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
          { key: "pay", header: "Costo/mes", align: "right", render: (t) => (
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
              {/* ── Edit section ─────────────────────────────────────────── */}
              {editing ? (
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Editar entrenador</h3>
                  {editError && <p className="text-sm text-red-600">{editError}</p>}
                  <div className="space-y-1">
                    <Label>Nombre *</Label>
                    <Input value={editForm.name} onChange={(e) => setEditForm({ name: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button onClick={handleSaveEdit} disabled={editSubmitting}>
                      {editSubmitting ? "Guardando…" : "Guardar"}
                    </Button>
                    <Button variant="secondary" onClick={() => setEditing(false)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={startEdit}>Editar nombre</Button>
                  {selectedTrainer.active && (
                    <Button variant="danger" onClick={() => setConfirmId(selectedTrainer.id)}>Desactivar</Button>
                  )}
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
                        <div key={tg.id} className="rounded-lg border border-[#E5E4E0] bg-white p-4 space-y-3">
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

                          <div className="text-[11px] text-[#A5A49D] border-t border-[#F0EFEB] pt-2">
                            {formatCurrency(rate)}/h × {(totalMinutes / 60).toFixed(1)}h/sem × 4,33 = {formatCurrency(monthlyCost)}/mes
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

      <ConfirmDialog
        open={confirmId !== null}
        title="Desactivar entrenador"
        message="Ya no aparecerá en la lista activa. Podés volver a verlo activando 'Mostrar inactivos'."
        confirmLabel="Desactivar"
        onConfirm={() => { const id = confirmId!; setConfirmId(null); handleDeactivate(id) }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
