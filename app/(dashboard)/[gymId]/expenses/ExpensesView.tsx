"use client"

import { useState } from "react"
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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

type FixedExpense = { id: string; name: string; amount: string; createdAt: string }
type EditForm = { name: string; amount: string }

const EMPTY_FORM = { name: "", amount: "" }

export default function ExpensesView({ gymId }: { gymId: string }) {
  const { data: expenses, loading, error, refetch } = useFetch<FixedExpense[]>(
    `/api/expenses?gymId=${gymId}`, [], "No se pudieron cargar los gastos.",
  )
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  type SortKey = "name" | "amount"
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const totalMensual = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  const displayed = expenses
    .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "name") cmp = a.name.localeCompare(b.name)
      else if (sortKey === "amount") cmp = Number(a.amount) - Number(b.amount)
      return sortDir === "asc" ? cmp : -cmp
    })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) { setFormError("El nombre es obligatorio."); return }
    if (!form.amount) { setFormError("El monto es obligatorio."); return }

    setSubmitting(true)
    const res = await fetch("/api/expenses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gymId, name: form.name.trim(), amount: Number(form.amount) }),
    })
    if (res.ok) { setForm(EMPTY_FORM); setShowForm(false); await refetch() }
    else { const d = await res.json().catch(() => ({})); setFormError(d?.error ?? "Error al crear el gasto.") }
    setSubmitting(false)
  }

  function startEdit(exp: FixedExpense) {
    setEditingId(exp.id); setEditForm({ name: exp.name, amount: String(exp.amount) }); setEditError(null)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    setEditError(null)
    if (!editForm.name.trim()) { setEditError("El nombre es obligatorio."); return }
    if (!editForm.amount) { setEditError("El monto es obligatorio."); return }
    setEditSubmitting(true)
    const res = await fetch(`/api/expenses/${editingId}?gymId=${gymId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editForm.name.trim(), amount: Number(editForm.amount) }),
    })
    if (res.ok) { setEditingId(null); await refetch() }
    else { const d = await res.json().catch(() => ({})); setEditError(d?.error ?? "Error al actualizar el gasto.") }
    setEditSubmitting(false)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const res = await fetch(`/api/expenses/${id}?gymId=${gymId}`, { method: "DELETE" })
    if (res.ok) await refetch()
    setDeletingId(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gastos fijos"
        subtitle="Gastos mensuales recurrentes del gimnasio"
        action={<Button onClick={() => { setShowForm(true); setFormError(null) }}>+ Nuevo gasto</Button>}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard label="Total mensual" value={`$${totalMensual.toLocaleString("es-AR")}`} />
      </div>

      <SearchToolbar
        search={search} onSearchChange={setSearch} placeholder="Buscar gasto…"
        sortOptions={[
          { value: "name", label: "Ordenar por nombre" },
          { value: "amount", label: "Ordenar por monto" },
        ]}
        sortKey={sortKey} onSortKeyChange={(k) => setSortKey(k as SortKey)}
        sortDir={sortDir} onSortDirToggle={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
      />

      <FormModal
        open={showForm}
        title="Nuevo gasto fijo"
        error={formError}
        onSubmit={handleCreate}
        submitting={submitting}
        onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(null) }}
      >
        <FormField label="Nombre" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Alquiler" />
        </FormField>
        <FormField label="Monto mensual" required>
          <NumberInput value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Ej: 50000" />
        </FormField>
      </FormModal>

      <FormModal
        open={editingId !== null}
        title="Editar gasto fijo"
        error={editError}
        onSubmit={handleSaveEdit}
        submitting={editSubmitting}
        onCancel={() => { setEditingId(null); setEditForm(EMPTY_FORM); setEditError(null) }}
      >
        <FormField label="Nombre" required>
          <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Alquiler" />
        </FormField>
        <FormField label="Monto mensual" required>
          <NumberInput value={editForm.amount} onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))} placeholder="Ej: 50000" />
        </FormField>
      </FormModal>

      <DataTable
        columns={[
          { key: "name", header: "Nombre", render: (exp) => <span className="font-medium text-[#111110]">{exp.name}</span> },
          { key: "amount", header: "Monto mensual", align: "right", render: (exp) => <span className="font-mono text-[#68685F]">${Number(exp.amount).toLocaleString("es-AR")}</span> },
          { key: "actions", header: "", align: "right", render: (exp) => (
            <div className="flex items-center justify-end gap-3">
              <Button variant="link" onClick={() => startEdit(exp)}>Editar</Button>
              <Button variant="danger" onClick={() => setConfirmId(exp.id)} disabled={deletingId === exp.id}>
                {deletingId === exp.id ? "…" : "Eliminar"}
              </Button>
            </div>
          )},
        ]}
        data={displayed}
        loading={loading}
        error={error}
        emptyMessage={search ? "Sin resultados para esa búsqueda." : "No hay gastos fijos registrados."}
        emptyHint={!search ? "Agregá el primer gasto con el botón de arriba." : undefined}
        minWidth="400px"
        rowKey={(exp) => exp.id}
      />

      <ConfirmDialog
        open={confirmId !== null}
        title="Eliminar gasto fijo"
        message="¿Estás seguro? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => { const id = confirmId!; setConfirmId(null); handleDelete(id) }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
