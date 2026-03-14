"use client"

import { useState } from "react"
import Link from "next/link"
import { useFetch } from "@/hooks/useFetch"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { FormField } from "@/components/ui/FormField"
import { StatCard } from "@/components/ui/StatCard"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchToolbar } from "@/components/ui/SearchToolbar"
import { DataTable } from "@/components/ui/DataTable"
import { InlineForm } from "@/components/ui/InlineForm"

type Group = {
  id: string
  name: string
  monthlyPrice: string
  maxCapacity: number | null
  _count: { students: number }
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
  type SortKey = "name" | "price" | "students"
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const totalStudents = groups.reduce((sum, g) => sum + g._count.students, 0)

  const displayed = groups
    .filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "name") cmp = a.name.localeCompare(b.name)
      else if (sortKey === "price") cmp = Number(a.monthlyPrice) - Number(b.monthlyPrice)
      else if (sortKey === "students") cmp = a._count.students - b._count.students
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

      {showForm && (
        <InlineForm
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
            <Input type="number" min="0" step="0.01" value={form.monthlyPrice} onChange={(e) => setForm((f) => ({ ...f, monthlyPrice: e.target.value }))} placeholder="Ej: 15000" />
          </FormField>
          <FormField label="Capacidad máx.">
            <Input type="number" min="1" value={form.maxCapacity} onChange={(e) => setForm((f) => ({ ...f, maxCapacity: e.target.value }))} placeholder="Sin límite" />
          </FormField>
        </InlineForm>
      )}

      <SearchToolbar
        search={search} onSearchChange={setSearch} placeholder="Buscar grupo…"
        sortOptions={[
          { value: "name", label: "Ordenar por nombre" },
          { value: "price", label: "Ordenar por precio" },
          { value: "students", label: "Ordenar por alumnos" },
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
          { key: "actions", header: "", align: "right", render: (g) => (
            <Link href={`/${gymId}/groups/${g.id}`} className="text-xs font-medium text-[#68685F] hover:text-[#111110] underline underline-offset-2 transition-colors">
              Ver detalle →
            </Link>
          )},
        ]}
        data={displayed}
        loading={loading}
        error={error}
        emptyMessage={search ? "Sin resultados para esa búsqueda." : "No hay grupos registrados."}
        emptyHint={!search ? "Creá el primer grupo con el botón de arriba." : undefined}
        minWidth="560px"
        rowKey={(g) => g.id}
      />
    </div>
  )
}
