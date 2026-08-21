"use client"

import { useState } from "react"
import { useFetch } from "@/hooks/useFetch"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { NumberInput } from "@/components/ui/NumberInput"
import { Select } from "@/components/ui/Select"
import { FormField } from "@/components/ui/FormField"
import { StatCard } from "@/components/ui/StatCard"
import { StatusDot } from "@/components/ui/StatusDot"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchToolbar } from "@/components/ui/SearchToolbar"
import { DataTable } from "@/components/ui/DataTable"
import { FormModal } from "@/components/ui/FormModal"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import {
  DISCOUNT_TYPE_LABEL, DISCOUNT_TYPE_HINT, ON_TIME_ONLY_HINT, ON_TIME_ONLY_LABEL,
  formatDiscountValue, formatGracePeriod, type DiscountType,
} from "@/lib/discounts-format"

type Discount = {
  id: string
  name: string
  description: string | null
  type: DiscountType
  value: string
  active: boolean
  loseOnLatePayment: boolean
  graceDays: number
  createdAt: string
  _count: { students: number }
}

type Form = {
  name: string
  description: string
  type: DiscountType
  value: string
  active: boolean
  loseOnLatePayment: boolean
  graceDays: string
}

const EMPTY_FORM: Form = {
  name: "", description: "", type: "PERCENTAGE", value: "", active: true,
  loseOnLatePayment: false, graceDays: "0",
}

const TYPE_OPTIONS: DiscountType[] = ["PERCENTAGE", "FIXED_AMOUNT", "FIXED_PRICE"]

export default function DiscountsView({ gymId }: { gymId: string }) {
  const { data: discounts, loading, error, refetch } = useFetch<Discount[]>(
    `/api/discounts?gymId=${gymId}`, [], "No se pudieron cargar los descuentos.",
  )

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Form>(EMPTY_FORM)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  type SortKey = "name" | "students"
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const activos = discounts.filter((d) => d.active).length
  const asignados = discounts.reduce((sum, d) => sum + d._count.students, 0)

  const confirmStudents = confirmId
    ? discounts.find((d) => d.id === confirmId)?._count.students ?? 0
    : 0

  const displayed = discounts
    .filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const cmp = sortKey === "name"
        ? a.name.localeCompare(b.name)
        : a._count.students - b._count.students
      return sortDir === "asc" ? cmp : -cmp
    })

  function payloadFrom(f: Form) {
    return {
      name: f.name.trim(),
      description: f.description.trim() || null,
      type: f.type,
      value: Number(f.value),
      active: f.active,
      loseOnLatePayment: f.loseOnLatePayment,
      graceDays: f.loseOnLatePayment ? Number(f.graceDays || 0) : 0,
    }
  }

  function validate(f: Form): string | null {
    if (!f.name.trim()) return "El nombre es obligatorio."
    if (!f.value) return "El valor es obligatorio."
    if (Number(f.value) <= 0) return "El valor debe ser mayor a cero."
    if (f.type === "PERCENTAGE" && Number(f.value) > 100) return "Un descuento porcentual no puede superar el 100%."
    if (f.loseOnLatePayment) {
      const grace = Number(f.graceDays || 0)
      if (!Number.isInteger(grace) || grace < 0) return "Los días de gracia tienen que ser un número entero de 0 o más."
      if (grace > 60) return "Los días de gracia no pueden pasar de 60."
    }
    return null
  }

  /** Los errores de Zod llegan como objeto; los de dominio, como string. */
  async function errorMessageFrom(res: Response, fallback: string) {
    const data = await res.json().catch(() => ({}))
    return typeof data?.error === "string" ? data.error : fallback
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const invalid = validate(form)
    if (invalid) { setFormError(invalid); return }

    setFormError(null)
    setSubmitting(true)
    const res = await fetch("/api/discounts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gymId, ...payloadFrom(form) }),
    })
    if (res.ok) { setForm(EMPTY_FORM); setShowForm(false); await refetch() }
    else setFormError(await errorMessageFrom(res, "No se pudo crear el descuento."))
    setSubmitting(false)
  }

  function startEdit(d: Discount) {
    setEditingId(d.id)
    setEditForm({
      name: d.name,
      description: d.description ?? "",
      type: d.type,
      value: String(d.value),
      active: d.active,
      loseOnLatePayment: d.loseOnLatePayment,
      graceDays: String(d.graceDays),
    })
    setEditError(null)
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    const invalid = validate(editForm)
    if (invalid) { setEditError(invalid); return }

    setEditError(null)
    setEditSubmitting(true)
    const res = await fetch(`/api/discounts/${editingId}?gymId=${gymId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFrom(editForm)),
    })
    if (res.ok) { setEditingId(null); await refetch() }
    else setEditError(await errorMessageFrom(res, "No se pudo actualizar el descuento."))
    setEditSubmitting(false)
  }

  async function handleToggleActive(d: Discount) {
    setTogglingId(d.id)
    setDeleteError(null)
    const res = await fetch(`/api/discounts/${d.id}?gymId=${gymId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !d.active }),
    })
    if (res.ok) await refetch()
    else setDeleteError(await errorMessageFrom(res, "No se pudo cambiar el estado del descuento."))
    setTogglingId(null)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setDeleteError(null)
    const res = await fetch(`/api/discounts/${id}?gymId=${gymId}`, { method: "DELETE" })
    if (res.ok) await refetch()
    else setDeleteError(await errorMessageFrom(res, "No se pudo eliminar el descuento."))
    setDeletingId(null)
  }

  const formFields = (f: Form, set: (updater: (prev: Form) => Form) => void) => (
    <>
      <FormField label="Nombre" required>
        <Input value={f.name} onChange={(e) => set((p) => ({ ...p, name: e.target.value }))} placeholder="Ej: Hermanos" />
      </FormField>
      <FormField label="Tipo de descuento" required>
        <Select value={f.type} onChange={(e) => set((p) => ({ ...p, type: e.target.value as DiscountType }))}>
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{DISCOUNT_TYPE_LABEL[t]}</option>
          ))}
        </Select>
      </FormField>
      <FormField label={f.type === "PERCENTAGE" ? "Porcentaje (%)" : f.type === "FIXED_AMOUNT" ? "Monto a descontar ($)" : "Precio final de la cuota ($)"} required>
        <NumberInput
          value={f.value}
          onChange={(e) => set((p) => ({ ...p, value: e.target.value }))}
          placeholder={f.type === "PERCENTAGE" ? "Ej: 20" : "Ej: 15000"}
        />
      </FormField>
      <FormField label="Estado">
        <Select value={f.active ? "1" : "0"} onChange={(e) => set((p) => ({ ...p, active: e.target.value === "1" }))}>
          <option value="1">Activo</option>
          <option value="0">Desactivado</option>
        </Select>
      </FormField>
      <div className="sm:col-span-2">
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] px-3 py-2.5">
          <input
            type="checkbox"
            checked={f.loseOnLatePayment}
            onChange={(e) => set((p) => ({ ...p, loseOnLatePayment: e.target.checked }))}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded accent-[#111110]"
          />
          <span>
            <span className="block text-sm font-medium text-[#111110]">{ON_TIME_ONLY_LABEL}</span>
            <span className="mt-0.5 block text-xs text-[#A5A49D]">{ON_TIME_ONLY_HINT}</span>
          </span>
        </label>

        {f.loseOnLatePayment && (
          <div className="mt-2 rounded-lg border border-[#E5E4E0] bg-white px-3 py-2.5">
            <FormField label="Días de gracia">
              <NumberInput
                integer
                value={f.graceDays}
                onChange={(e) => set((p) => ({ ...p, graceDays: e.target.value }))}
                placeholder="Ej: 5"
              />
            </FormField>
            <p className="mt-2 text-xs text-[#A5A49D]">
              {formatGracePeriod(Number(f.graceDays || 0))}. La cuota sigue figurando como vencida
              desde su fecha de vencimiento; esto solo corre el plazo del descuento.
            </p>
          </div>
        )}
      </div>
      <div className="sm:col-span-2">
        <FormField label="Descripción">
          <Input
            value={f.description}
            onChange={(e) => set((p) => ({ ...p, description: e.target.value }))}
            placeholder="Ej: 20% para el segundo hermano"
          />
        </FormField>
        <p className="mt-2 text-xs text-[#A5A49D]">{DISCOUNT_TYPE_HINT[f.type]}</p>
      </div>
    </>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Descuentos"
        subtitle="Se aplican solos a la cuota de los alumnos que los tengan asignados"
        action={<Button onClick={() => { setShowForm(true); setForm(EMPTY_FORM); setFormError(null) }}>+ Nuevo descuento</Button>}
      />

      {deleteError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{deleteError}</div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Descuentos" value={discounts.length} />
        <StatCard label="Activos" value={activos} valueColor="text-emerald-700" />
        <StatCard label="Alumnos alcanzados" value={asignados} />
      </div>

      <SearchToolbar
        search={search} onSearchChange={setSearch} placeholder="Buscar descuento…"
        sortOptions={[
          { value: "name", label: "Ordenar por nombre" },
          { value: "students", label: "Ordenar por alumnos" },
        ]}
        sortKey={sortKey} onSortKeyChange={(k) => setSortKey(k as SortKey)}
        sortDir={sortDir} onSortDirToggle={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
      />

      <FormModal
        open={showForm}
        title="Nuevo descuento"
        error={formError}
        onSubmit={handleCreate}
        submitting={submitting}
        onCancel={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(null) }}
      >
        {formFields(form, setForm)}
      </FormModal>

      <FormModal
        open={editingId !== null}
        title="Editar descuento"
        error={editError}
        onSubmit={handleSaveEdit}
        submitting={editSubmitting}
        onCancel={() => { setEditingId(null); setEditError(null) }}
      >
        {formFields(editForm, setEditForm)}
      </FormModal>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Descuento",
            render: (d) => (
              <div>
                <span className="font-medium text-[#111110]">{d.name}</span>
                {d.loseOnLatePayment && (
                  <span
                    className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700"
                    title={formatGracePeriod(d.graceDays)}
                  >
                    {ON_TIME_ONLY_LABEL}
                    {d.graceDays > 0 ? ` · ${d.graceDays}d de gracia` : ""}
                  </span>
                )}
                {d.description && <p className="text-xs text-[#A5A49D] mt-0.5">{d.description}</p>}
              </div>
            ),
          },
          {
            key: "type",
            header: "Tipo",
            render: (d) => <span className="text-sm text-[#68685F]">{DISCOUNT_TYPE_LABEL[d.type]}</span>,
          },
          {
            key: "value",
            header: "Valor",
            align: "right",
            render: (d) => (
              <span className="font-mono font-medium text-[#111110]">{formatDiscountValue(d.type, d.value)}</span>
            ),
          },
          {
            key: "students",
            header: "Alumnos",
            align: "right",
            render: (d) => <span className="font-mono text-[#68685F]">{d._count.students}</span>,
          },
          {
            key: "status",
            header: "Estado",
            render: (d) => (
              <StatusDot
                dotColor={d.active ? "bg-emerald-500" : "bg-[#A5A49D]"}
                textColor={d.active ? "text-emerald-700" : "text-[#68685F]"}
                label={d.active ? "Activo" : "Desactivado"}
              />
            ),
          },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (d) => (
              <div className="flex items-center justify-end gap-3">
                <Button variant="link" onClick={() => startEdit(d)}>Editar</Button>
                <Button variant="link" onClick={() => handleToggleActive(d)} disabled={togglingId === d.id}>
                  {togglingId === d.id ? "…" : d.active ? "Desactivar" : "Activar"}
                </Button>
                <Button variant="danger" onClick={() => { setDeleteError(null); setConfirmId(d.id) }} disabled={deletingId === d.id}>
                  {deletingId === d.id ? "…" : "Eliminar"}
                </Button>
              </div>
            ),
          },
        ]}
        data={displayed}
        loading={loading}
        error={error}
        emptyMessage={search ? "Sin resultados para esa búsqueda." : "No hay descuentos creados."}
        emptyHint={!search ? "Creá uno y asignáselo a un alumno desde su ficha, en Alumnos." : undefined}
        minWidth="720px"
        rowKey={(d) => d.id}
      />

      <ConfirmDialog
        open={confirmId !== null}
        title="Eliminar descuento"
        message={
          <div className="space-y-2">
            <p>Se elimina de forma permanente y se les quita a los alumnos que lo tengan asignado.</p>
            {confirmStudents > 0 && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {confirmStudents === 1
                  ? "1 alumno vuelve a pagar la cuota completa."
                  : `${confirmStudents} alumnos vuelven a pagar la cuota completa.`}
              </p>
            )}
            <p className="text-sm text-[#68685F]">
              Las cuotas pendientes se recalculan sin el descuento. Las ya cobradas quedan como se cobraron.
              Si querés dejar de usarlo sin borrarlo, desactivalo.
            </p>
          </div>
        }
        confirmLabel="Eliminar"
        onConfirm={() => { const id = confirmId!; setConfirmId(null); handleDelete(id) }}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
