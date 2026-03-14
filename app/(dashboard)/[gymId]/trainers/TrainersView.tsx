"use client"

import { useState } from "react"
import { useFetch } from "@/hooks/useFetch"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Label } from "@/components/ui/Label"
import { FormField } from "@/components/ui/FormField"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchToolbar } from "@/components/ui/SearchToolbar"
import { DataTable } from "@/components/ui/DataTable"
import { InlineForm } from "@/components/ui/InlineForm"

type ContractType = "HOURLY" | "MONTHLY"
type Trainer = { id: string; name: string; contractType: ContractType; active: boolean }

const CONTRACT_LABEL: Record<ContractType, string> = { HOURLY: "Por hora", MONTHLY: "Mensual" }

export default function TrainersView({ gymId }: { gymId: string }) {
  const { data: trainers, loading, error, refetch } = useFetch<Trainer[]>(
    `/api/trainers?gymId=${gymId}`, [], "No se pudieron cargar los entrenadores.",
  )
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<{ name: string; contractType: ContractType }>({ name: "", contractType: "HOURLY" })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; contractType: ContractType }>({ name: "", contractType: "HOURLY" })
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  type SortKey = "name" | "contract"
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const base = showInactive ? trainers : trainers.filter((t) => t.active)
  const displayed = base
    .filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "name") cmp = a.name.localeCompare(b.name)
      else if (sortKey === "contract") cmp = a.contractType.localeCompare(b.contractType)
      return sortDir === "asc" ? cmp : -cmp
    })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) { setFormError("El nombre es obligatorio."); return }
    setSubmitting(true)
    const res = await fetch("/api/trainers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gymId, name: form.name.trim(), contractType: form.contractType }),
    })
    if (res.ok) { setForm({ name: "", contractType: "HOURLY" }); setShowForm(false); await refetch() }
    else { const d = await res.json().catch(() => ({})); setFormError(d?.error ?? "Error al crear el entrenador.") }
    setSubmitting(false)
  }

  function startEdit(t: Trainer) {
    setEditingId(t.id); setEditForm({ name: t.name, contractType: t.contractType }); setEditError(null)
  }

  async function handleSaveEdit(id: string) {
    setEditError(null)
    if (!editForm.name.trim()) { setEditError("El nombre es obligatorio."); return }
    setEditSubmitting(true)
    const res = await fetch(`/api/trainers/${id}?gymId=${gymId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name.trim(), contractType: editForm.contractType }),
    })
    if (res.ok) { setEditingId(null); await refetch() }
    else { const d = await res.json().catch(() => ({})); setEditError(d?.error ?? "Error al actualizar el entrenador.") }
    setEditSubmitting(false)
  }

  async function handleDeactivate(id: string) {
    setDeactivatingId(id)
    const res = await fetch(`/api/trainers/${id}?gymId=${gymId}`, { method: "DELETE" })
    if (res.ok) await refetch()
    setDeactivatingId(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entrenadores"
        subtitle="Entrenadores del gimnasio"
        action={<Button onClick={() => { setShowForm(true); setFormError(null) }}>+ Nuevo entrenador</Button>}
      />

      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowInactive((v) => !v)}
          className={`text-xs font-medium transition-colors ${
            showInactive ? "text-[#111110] underline underline-offset-2" : "text-[#68685F] hover:text-[#111110]"
          }`}
        >
          {showInactive ? "Ocultar inactivos" : "Mostrar inactivos"}
        </button>
      </div>

      <SearchToolbar
        search={search} onSearchChange={setSearch} placeholder="Buscar entrenador…"
        sortOptions={[
          { value: "name", label: "Ordenar por nombre" },
          { value: "contract", label: "Ordenar por contrato" },
        ]}
        sortKey={sortKey} onSortKeyChange={(k) => setSortKey(k as SortKey)}
        sortDir={sortDir} onSortDirToggle={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
      />

      {showForm && (
        <InlineForm
          title="Nuevo entrenador"
          error={formError}
          onSubmit={handleCreate}
          submitting={submitting}
          onCancel={() => { setShowForm(false); setForm({ name: "", contractType: "HOURLY" }); setFormError(null) }}
        >
          <FormField label="Nombre" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Carlos López" />
          </FormField>
          <FormField label="Tipo de contrato" required>
            <Select value={form.contractType} onChange={(e) => setForm((f) => ({ ...f, contractType: e.target.value as ContractType }))}>
              <option value="HOURLY">Por hora</option>
              <option value="MONTHLY">Mensual</option>
            </Select>
          </FormField>
        </InlineForm>
      )}

      <DataTable
        columns={[
          { key: "name", header: "Nombre", render: (t) => <span className="font-medium text-[#111110]">{t.name}</span> },
          { key: "contract", header: "Contrato", render: (t) => <span className="text-[#68685F]">{CONTRACT_LABEL[t.contractType]}</span> },
          { key: "actions", header: "", align: "right", render: (t) => (
            <div className="flex items-center justify-end gap-3">
              <Button variant="link" onClick={() => startEdit(t)}>Editar</Button>
              {t.active && (
                <Button variant="danger" onClick={() => handleDeactivate(t.id)} disabled={deactivatingId === t.id}>
                  {deactivatingId === t.id ? "…" : "Desactivar"}
                </Button>
              )}
            </div>
          )},
        ]}
        data={displayed}
        loading={loading}
        error={error}
        emptyMessage={search ? "Sin resultados para esa búsqueda." : showInactive ? "No hay entrenadores registrados." : "No hay entrenadores activos."}
        minWidth="400px"
        rowKey={(t) => t.id}
        rowClassName={(t, i) => `hover:bg-[#FAFAF9] transition-colors ${i > 0 ? "border-t border-[#F7F6F3]" : ""} ${!t.active ? "opacity-50" : ""}`}
        renderRow={(t, i, defaultRow) => {
          if (editingId !== t.id) return defaultRow
          return (
            <tr key={t.id} className={`hover:bg-[#FAFAF9] transition-colors ${i > 0 ? "border-t border-[#F7F6F3]" : ""}`}>
              <td className="px-5 py-3" colSpan={3}>
                <div className="space-y-3">
                  {editError && <p className="text-sm text-red-600">{editError}</p>}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <Label>Nombre *</Label>
                      <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label>Tipo de contrato *</Label>
                      <Select value={editForm.contractType} onChange={(e) => setEditForm((f) => ({ ...f, contractType: e.target.value as ContractType }))}>
                        <option value="HOURLY">Por hora</option>
                        <option value="MONTHLY">Mensual</option>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button onClick={() => handleSaveEdit(t.id)} disabled={editSubmitting}>
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
    </div>
  )
}
