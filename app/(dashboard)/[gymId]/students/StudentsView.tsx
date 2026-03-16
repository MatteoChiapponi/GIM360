"use client"

import { useState } from "react"
import { useFetch } from "@/hooks/useFetch"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { FormField } from "@/components/ui/FormField"
import { StatCard } from "@/components/ui/StatCard"
import { StatusDot } from "@/components/ui/StatusDot"
import { Tabs } from "@/components/ui/Tabs"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchToolbar } from "@/components/ui/SearchToolbar"
import { DataTable } from "@/components/ui/DataTable"
import { FormModal } from "@/components/ui/FormModal"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

type MedicalClearance = "PENDING" | "APPROVED" | "EXPIRED"

type Student = {
  id: string; firstName: string; lastName: string
  phone: string | null; medicalClearance: MedicalClearance
  leftAt: string | null; dueDay: number
}

type NewForm = { firstName: string; lastName: string; dueDay: string; phone: string }
type EditForm = { firstName: string; lastName: string; dueDay: string; phone: string }

const EMPTY_FORM: NewForm = { firstName: "", lastName: "", dueDay: "", phone: "" }

const MEDICAL_LABEL: Record<MedicalClearance, string> = { APPROVED: "Aprobado", PENDING: "Pendiente", EXPIRED: "Vencido" }
const MEDICAL_DOT: Record<MedicalClearance, string> = { APPROVED: "bg-emerald-500", PENDING: "bg-amber-400", EXPIRED: "bg-red-500" }
const MEDICAL_TEXT: Record<MedicalClearance, string> = { APPROVED: "text-emerald-700", PENDING: "text-amber-700", EXPIRED: "text-red-700" }

type FilterTab = "ACTIVOS" | "TODOS"

export default function StudentsView({ gymId }: { gymId: string }) {
  const { data: students, loading, error, refetch } = useFetch<Student[]>(
    `/api/students?gymId=${gymId}`, [], "No se pudieron cargar los alumnos.",
  )
  const [filter, setFilter] = useState<FilterTab>("ACTIVOS")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<NewForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ firstName: "", lastName: "", dueDay: "", phone: "" })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  type SortKey = "lastName" | "firstName" | "dueDay" | "medical"
  const [sortKey, setSortKey] = useState<SortKey>("lastName")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const activos = students.filter((s) => s.leftAt === null)
  const bajas = students.filter((s) => s.leftAt !== null)
  const base = filter === "ACTIVOS" ? activos : students
  const displayed = base
    .filter((s) =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone ?? "").includes(search)
    )
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "lastName") cmp = a.lastName.localeCompare(b.lastName)
      else if (sortKey === "firstName") cmp = a.firstName.localeCompare(b.firstName)
      else if (sortKey === "dueDay") cmp = a.dueDay - b.dueDay
      else if (sortKey === "medical") cmp = a.medicalClearance.localeCompare(b.medicalClearance)
      return sortDir === "asc" ? cmp : -cmp
    })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.firstName.trim()) { setFormError("El nombre es obligatorio."); return }
    if (!form.lastName.trim()) { setFormError("El apellido es obligatorio."); return }
    if (!form.dueDay) { setFormError("El día de cobro es obligatorio."); return }
    const day = Number(form.dueDay)
    if (isNaN(day) || day < 1 || day > 31) { setFormError("El día de cobro debe ser entre 1 y 31."); return }

    setSubmitting(true)
    const body: Record<string, unknown> = { gymId, firstName: form.firstName.trim(), lastName: form.lastName.trim(), dueDay: day }
    if (form.phone.trim()) body.phone = form.phone.trim()

    const res = await fetch("/api/students", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    if (res.ok) { setForm(EMPTY_FORM); setShowForm(false); await refetch() }
    else { const d = await res.json().catch(() => ({})); setFormError(d?.error ?? "Error al crear el alumno.") }
    setSubmitting(false)
  }

  function startEdit(s: Student) {
    setEditingId(s.id)
    setEditForm({ firstName: s.firstName, lastName: s.lastName, dueDay: String(s.dueDay), phone: s.phone ?? "" })
    setEditError(null)
  }

  async function handleSaveEdit(id: string) {
    setEditError(null)
    if (!editForm.firstName.trim()) { setEditError("El nombre es obligatorio."); return }
    if (!editForm.lastName.trim()) { setEditError("El apellido es obligatorio."); return }
    const day = Number(editForm.dueDay)
    if (isNaN(day) || day < 1 || day > 31) { setEditError("El día de cobro debe ser entre 1 y 31."); return }

    setEditSubmitting(true)
    const body: Record<string, unknown> = {
      firstName: editForm.firstName.trim(), lastName: editForm.lastName.trim(),
      dueDay: day, phone: editForm.phone.trim() || null,
    }
    const res = await fetch(`/api/students/${id}?gymId=${gymId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    if (res.ok) { setEditingId(null); await refetch() }
    else { const d = await res.json().catch(() => ({})); setEditError(d?.error ?? "Error al actualizar el alumno.") }
    setEditSubmitting(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const res = await fetch(`/api/students/${id}?gymId=${gymId}`, { method: "DELETE" })
    if (res.ok) await refetch()
    setDeletingId(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alumnos"
        subtitle="Listado de alumnos del gimnasio"
        action={<Button onClick={() => { setShowForm(true); setFormError(null) }}>+ Nuevo alumno</Button>}
      />

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Activos" value={activos.length} valueColor="text-emerald-700" />
        <StatCard label="Bajas" value={bajas.length} valueColor="text-red-700" />
      </div>

      <Tabs
        tabs={[{ key: "ACTIVOS" as FilterTab, label: "Activos" }, { key: "TODOS" as FilterTab, label: "Todos" }]}
        active={filter}
        onChange={setFilter}
      />

      <SearchToolbar
        search={search} onSearchChange={setSearch} placeholder="Buscar por nombre o teléfono…"
        searchWidth="sm:w-72"
        sortOptions={[
          { value: "lastName", label: "Ordenar por apellido" },
          { value: "firstName", label: "Ordenar por nombre" },
          { value: "dueDay", label: "Ordenar por día de cobro" },
          { value: "medical", label: "Ordenar por apto médico" },
        ]}
        sortKey={sortKey} onSortKeyChange={(k) => setSortKey(k as SortKey)}
        sortDir={sortDir} onSortDirToggle={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
      />

      <FormModal
        open={showForm}
        title="Nuevo alumno"
        error={formError}
        onSubmit={handleCreate}
        submitting={submitting}
        onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(null) }}
        gridCols="sm:grid-cols-2"
      >
        <FormField label="Nombre" required>
          <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Ej: María" />
        </FormField>
        <FormField label="Apellido" required>
          <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Ej: García" />
        </FormField>
        <FormField label="Día de cobro" required>
          <Input type="number" min="1" max="31" value={form.dueDay} onChange={(e) => setForm((f) => ({ ...f, dueDay: e.target.value }))} placeholder="Ej: 10" />
        </FormField>
        <FormField label="Teléfono">
          <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Ej: 11 1234-5678" />
        </FormField>
      </FormModal>

      <DataTable
        columns={[
          { key: "name", header: "Nombre", render: (s) => <span className="font-medium text-[#111110]">{s.firstName} {s.lastName}</span> },
          { key: "phone", header: "Tel.", render: (s) => <span className="text-[#68685F]">{s.phone ?? <span className="text-[#A5A49D]">—</span>}</span> },
          { key: "medical", header: "Apto médico", render: (s) => <StatusDot dotColor={MEDICAL_DOT[s.medicalClearance]} textColor={MEDICAL_TEXT[s.medicalClearance]} label={MEDICAL_LABEL[s.medicalClearance]} /> },
          { key: "dueDay", header: "Día de cobro", align: "right", render: (s) => <span className="font-mono text-[#68685F]">{s.dueDay}</span> },
          { key: "status", header: "Estado", render: (s) => s.leftAt === null
            ? <StatusDot dotColor="bg-emerald-500" textColor="text-emerald-700" label="Activo" />
            : <StatusDot dotColor="bg-red-500" textColor="text-red-700" label="Baja" />
          },
          { key: "actions", header: "", align: "right", render: (s) => (
            <div className="flex items-center justify-end gap-3">
              <Button variant="link" onClick={() => startEdit(s)}>Editar</Button>
              {s.leftAt === null && (
                <Button variant="danger" onClick={() => setConfirmId(s.id)} disabled={deletingId === s.id}>
                  {deletingId === s.id ? "…" : "Dar de baja"}
                </Button>
              )}
            </div>
          )},
        ]}
        data={displayed}
        loading={loading}
        error={error}
        emptyMessage={search ? "Sin resultados para esa búsqueda." : filter === "ACTIVOS" ? "No hay alumnos activos." : "No hay alumnos registrados."}
        emptyHint={!search ? "Agregá el primer alumno con el botón de arriba." : undefined}
        minWidth="680px"
        rowKey={(s) => s.id}
        renderRow={(s, i, defaultRow) => {
          if (editingId !== s.id) return defaultRow
          return (
            <tr key={s.id} className={`hover:bg-[#FAFAF9] transition-colors ${i > 0 ? "border-t border-[#F7F6F3]" : ""}`}>
              <td className="px-5 py-3" colSpan={6}>
                <div className="space-y-3">
                  {editError && <p className="text-sm text-red-600">{editError}</p>}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex flex-col gap-1">
                      <Label>Nombre *</Label>
                      <Input value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>Apellido *</Label>
                      <Input value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>Día de cobro *</Label>
                      <Input type="number" min="1" max="31" value={editForm.dueDay} onChange={(e) => setEditForm((f) => ({ ...f, dueDay: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>Teléfono</Label>
                      <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button onClick={() => handleSaveEdit(s.id)} disabled={editSubmitting}>
                      {editSubmitting ? "Guardando…" : "Guardar"}
                    </Button>
                    <Button variant="secondary" onClick={() => { setEditingId(null); setEditError(null) }}>Cancelar</Button>
                  </div>
                </div>
              </td>
            </tr>
          )
        }}
      />

      <ConfirmDialog
        open={confirmId !== null}
        title="Dar de baja al alumno"
        message="Se marcará como inactivo y dejará de aparecer en la lista activa. Podés verlo activando 'Todos'."
        confirmLabel="Dar de baja"
        onConfirm={() => { const id = confirmId!; setConfirmId(null); handleDelete(id) }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
