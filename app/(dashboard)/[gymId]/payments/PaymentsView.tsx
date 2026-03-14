"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/Input"
import { StatCard } from "@/components/ui/StatCard"
import { StatusDot } from "@/components/ui/StatusDot"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchToolbar } from "@/components/ui/SearchToolbar"
import { DataTable } from "@/components/ui/DataTable"
import { Button } from "@/components/ui/Button"

type PaymentStatus = "PENDING" | "PAID" | "EXPIRED"

type Payment = {
  id: string; amount: string; status: PaymentStatus; paidAt: string | null
  student: { id: string; firstName: string; lastName: string; dueDay: number }
}

const STATUS_LABEL: Record<PaymentStatus, string> = { PAID: "Pagado", PENDING: "Pendiente", EXPIRED: "Vencido" }
const STATUS_DOT: Record<PaymentStatus, string> = { PAID: "bg-emerald-500", PENDING: "bg-amber-400", EXPIRED: "bg-red-500" }
const STATUS_TEXT: Record<PaymentStatus, string> = { PAID: "text-emerald-700", PENDING: "text-amber-700", EXPIRED: "text-red-700" }

function dueDate(period: string, dueDay: number): Date {
  const [year, month] = period.split("-").map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(dueDay, lastDay))
}

export default function PaymentsView({ gymId }: { gymId: string }) {
  const now = new Date()
  const maxPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const [period, setPeriod] = useState(maxPeriod)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  type SortKey = "name" | "amount" | "due" | "status"
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/payments?gymId=${gymId}&period=${period}`)
    const data = await res.json()
    if (res.ok && Array.isArray(data) && data.length === 0) {
      const genRes = await fetch("/api/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId, period }),
      })
      const genData = await genRes.json()
      setPayments(genRes.ok ? genData : [])
    } else {
      setPayments(res.ok ? data : [])
    }
    setLoading(false)
  }, [gymId, period])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  async function handleMarkPaid(id: string) {
    setUpdatingId(id)
    const res = await fetch(`/api/payments/${id}?gymId=${gymId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID", paidAt: new Date().toISOString() }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)))
    }
    setUpdatingId(null)
  }

  const STATUS_ORDER: Record<PaymentStatus, number> = { PENDING: 0, EXPIRED: 1, PAID: 2 }
  const displayed = payments
    .filter((p) => `${p.student.firstName} ${p.student.lastName}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "name") cmp = `${a.student.lastName} ${a.student.firstName}`.localeCompare(`${b.student.lastName} ${b.student.firstName}`)
      else if (sortKey === "amount") cmp = Number(a.amount) - Number(b.amount)
      else if (sortKey === "due") cmp = dueDate(period, a.student.dueDay).getTime() - dueDate(period, b.student.dueDay).getTime()
      else if (sortKey === "status") cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      return sortDir === "asc" ? cmp : -cmp
    })

  const paid = payments.filter((p) => p.status === "PAID").length
  const pending = payments.filter((p) => p.status === "PENDING").length
  const expired = payments.filter((p) => p.status === "EXPIRED").length
  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const collected = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount), 0)
  const collectionPct = total > 0 ? Math.round((collected / total) * 100) : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cuotas"
        subtitle="Control de cuotas mensuales"
        action={
          <Input
            type="month"
            value={period}
            max={maxPeriod}
            onChange={(e) => setPeriod(e.target.value)}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={payments.length} />
        <StatCard label="Pagados" value={paid} valueColor="text-emerald-700" />
        <StatCard label="Pendientes" value={pending} valueColor="text-amber-700" />
        <StatCard label="Vencidos" value={expired} valueColor="text-red-700" />
      </div>

      {payments.length > 0 && (
        <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#68685F]">
              <span className="font-semibold text-[#111110]">${collected.toLocaleString("es-AR")}</span>
              {" cobrados de "}
              <span className="text-[#A5A49D]">${total.toLocaleString("es-AR")}</span>
            </span>
            <span className="text-sm font-bold font-mono text-[#111110]">{collectionPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F0EFEB]">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${collectionPct}%` }} />
          </div>
        </div>
      )}

      <SearchToolbar
        search={search} onSearchChange={setSearch} placeholder="Buscar alumno…"
        sortOptions={[
          { value: "name", label: "Ordenar por nombre" },
          { value: "amount", label: "Ordenar por monto" },
          { value: "due", label: "Ordenar por vencimiento" },
          { value: "status", label: "Ordenar por estado" },
        ]}
        sortKey={sortKey} onSortKeyChange={(k) => setSortKey(k as SortKey)}
        sortDir={sortDir} onSortDirToggle={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}
      />

      <DataTable
        columns={[
          { key: "name", header: "Alumno", render: (p) => <span className="font-medium text-[#111110]">{p.student.firstName} {p.student.lastName}</span> },
          { key: "due", header: "Vencimiento", render: (p) => <span className="text-[#68685F]">{dueDate(period, p.student.dueDay).toLocaleDateString("es-AR")}</span> },
          { key: "amount", header: "Monto", align: "right", render: (p) => <span className="font-mono font-medium text-[#111110]">${Number(p.amount).toLocaleString("es-AR")}</span> },
          { key: "status", header: "Estado", render: (p) => <StatusDot dotColor={STATUS_DOT[p.status]} textColor={STATUS_TEXT[p.status]} label={STATUS_LABEL[p.status]} /> },
          { key: "paidAt", header: "Fecha de pago", render: (p) => <span className="text-[#A5A49D]">{p.paidAt ? new Date(p.paidAt).toLocaleDateString("es-AR") : "—"}</span> },
          { key: "actions", header: "", align: "right", render: (p) => {
            const busy = updatingId === p.id
            return p.status !== "PAID" ? (
              <Button variant="link" onClick={() => handleMarkPaid(p.id)} disabled={busy} className="disabled:opacity-40">
                {busy ? "…" : "Marcar pagado"}
              </Button>
            ) : null
          }},
        ]}
        data={displayed}
        loading={loading}
        emptyMessage={search ? "Sin resultados para esa búsqueda." : "No hay alumnos inscriptos en este período."}
        minWidth="580px"
        rowKey={(p) => p.id}
      />
    </div>
  )
}
