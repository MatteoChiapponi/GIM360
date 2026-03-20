"use client"

import { useState, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/Input"
import { StatCard } from "@/components/ui/StatCard"
import { StatusDot } from "@/components/ui/StatusDot"
import { PageHeader } from "@/components/ui/PageHeader"
import { SearchToolbar } from "@/components/ui/SearchToolbar"
import { DataTable } from "@/components/ui/DataTable"
import { Button } from "@/components/ui/Button"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"

type PaymentStatus = "PENDING" | "PAID" | "EXPIRED"
type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA"

type Payment = {
  id: string
  amount: string
  status: PaymentStatus
  paidAt: string | null
  paymentMethod: PaymentMethod | null
  verified: boolean
  cashClosingId: string | null
  student: { id: string; firstName: string; lastName: string; dueDay: number }
}

type ClosingReport = {
  totalCollected: string
  paidCount: number
  efectivoCount: number
  efectivoTotal: string
  transferenciaCount: number
  transferenciaTotal: string
  tarjetaCount: number
  tarjetaTotal: string
  fromDate: string
  toDate: string
}

const STATUS_LABEL: Record<PaymentStatus, string> = { PAID: "Pagado", PENDING: "Pendiente", EXPIRED: "Vencido" }
const STATUS_DOT: Record<PaymentStatus, string> = { PAID: "bg-emerald-500", PENDING: "bg-amber-400", EXPIRED: "bg-red-500" }
const STATUS_TEXT: Record<PaymentStatus, string> = { PAID: "text-emerald-700", PENDING: "text-amber-700", EXPIRED: "text-red-700" }

const METHOD_LABEL: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
}

const METHOD_BUTTONS: { value: PaymentMethod; label: string }[] = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "TARJETA", label: "Tarjeta" },
]

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

  // Payment method modal state
  const [payMethodForId, setPayMethodForId] = useState<string | null>(null)
  const payMethodPayment = payMethodForId ? payments.find((p) => p.id === payMethodForId) : null

  // Unmark confirmation
  const [confirmUnpayId, setConfirmUnpayId] = useState<string | null>(null)

  // Cash closing state
  const [showClosingConfirm, setShowClosingConfirm] = useState(false)
  const [closingSubmitting, setClosingSubmitting] = useState(false)
  const [closingReport, setClosingReport] = useState<ClosingReport | null>(null)

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

  async function handleMarkPaid(id: string, method: PaymentMethod) {
    setPayMethodForId(null)
    setUpdatingId(id)
    const res = await fetch(`/api/payments/${id}?gymId=${gymId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID", paidAt: new Date().toISOString(), paymentMethod: method }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)))
    }
    setUpdatingId(null)
  }

  async function handleUnmarkPaid(id: string) {
    setConfirmUnpayId(null)
    setUpdatingId(id)
    const res = await fetch(`/api/payments/${id}?gymId=${gymId}`, { method: "DELETE" })
    if (res.ok) {
      // Regenerate so the student reappears as PENDING
      await fetch("/api/payments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId, period }),
      })
      await fetchPayments()
    }
    setUpdatingId(null)
  }

  const [closingError, setClosingError] = useState<string | null>(null)

  async function handleCashClosing() {
    setClosingSubmitting(true)
    setClosingError(null)
    try {
      const res = await fetch("/api/cash-closings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId }),
      })
      const data = await res.json()
      if (res.ok) {
        setClosingReport({
          totalCollected: data.totalCollected,
          paidCount: data.paidCount,
          efectivoCount: data.efectivoCount,
          efectivoTotal: data.efectivoTotal,
          transferenciaCount: data.transferenciaCount,
          transferenciaTotal: data.transferenciaTotal,
          tarjetaCount: data.tarjetaCount,
          tarjetaTotal: data.tarjetaTotal,
          fromDate: data.fromDate,
          toDate: data.toDate,
        })
        setShowClosingConfirm(false)
        await fetchPayments()
      } else {
        setClosingError(data?.error ?? "Error al cerrar caja")
      }
    } catch {
      setClosingError("Error de conexión al cerrar caja")
    }
    setClosingSubmitting(false)
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
  const collected = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount), 0)
  const pendingAmount = payments.filter((p) => p.status === "PENDING").reduce((sum, p) => sum + Number(p.amount), 0)
  const total = collected + pendingAmount
  const collectionPct = total > 0 ? Math.round((collected / total) * 100) : 0

  const unverifiedPaid = payments.filter((p) => !p.verified && p.status === "PAID")
  const hasUnverifiedPaid = unverifiedPaid.length > 0
  const unverifiedCollected = unverifiedPaid.reduce((sum, p) => sum + Number(p.amount), 0)

  // Build closing confirmation breakdown by method
  const unverifiedByMethod = unverifiedPaid.reduce(
    (acc, p) => {
      const m = p.paymentMethod
      if (m) {
        acc[m] = { count: (acc[m]?.count ?? 0) + 1, total: (acc[m]?.total ?? 0) + Number(p.amount) }
      }
      return acc
    },
    {} as Record<PaymentMethod, { count: number; total: number }>,
  )

  const closingMessage = (
    <div className="space-y-3">
      <p>
        Se verificarán <span className="font-semibold">{unverifiedPaid.length}</span> pago{unverifiedPaid.length !== 1 ? "s" : ""} cobrado{unverifiedPaid.length !== 1 ? "s" : ""}.
      </p>
      <div className="rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] p-3 space-y-2">
        {(["EFECTIVO", "TRANSFERENCIA", "TARJETA"] as PaymentMethod[]).map((method) => {
          const data = unverifiedByMethod[method]
          if (!data) return null
          return (
            <div key={method} className="flex items-center justify-between text-sm">
              <span className="text-[#68685F]">{METHOD_LABEL[method]} ({data.count})</span>
              <span className="font-mono font-semibold text-[#111110]">${data.total.toLocaleString("es-AR")}</span>
            </div>
          )
        })}
        <div className="border-t border-[#E5E4E0] pt-2 flex items-center justify-between text-sm font-semibold">
          <span className="text-[#111110]">Total ({unverifiedPaid.length})</span>
          <span className="font-mono text-[#111110]">${unverifiedCollected.toLocaleString("es-AR")}</span>
        </div>
      </div>
      <p className="text-xs text-[#A5A49D]">Los pagos verificados no podrán modificarse.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cuotas"
        subtitle="Control de cuotas mensuales"
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative group">
              <button
                onClick={() => setShowClosingConfirm(true)}
                disabled={!hasUnverifiedPaid}
                className="inline-flex items-center gap-2 rounded-lg border border-[#E5E4E0] bg-white px-4 py-2.5 text-sm font-semibold text-[#111110] hover:bg-[#FAFAF9] hover:border-[#111110] transition-colors min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-[#E5E4E0]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M1 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4Zm12 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm13-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM1.75 14.5a.75.75 0 0 0 0 1.5c4.417 0 8.693.603 12.749 1.73 1.111.309 2.251-.512 2.251-1.696v-.784a.75.75 0 0 0-1.5 0v.784a.272.272 0 0 1-.35.25A49.043 49.043 0 0 0 1.75 14.5Z" clipRule="evenodd" />
                </svg>
                Cerrar caja
              </button>
              {!hasUnverifiedPaid && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max max-w-[220px] rounded-lg bg-[#111110] px-3 py-2 text-xs text-white text-center z-10">
                  No hay pagos cobrados sin verificar
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111110]" />
                </div>
              )}
            </div>
            <Input
              type="month"
              value={period}
              max={maxPeriod}
              onChange={(e) => setPeriod(e.target.value > maxPeriod ? maxPeriod : e.target.value)}
            />
          </div>
        }
      />

      {closingReport && (
        <div className="relative rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 space-y-2">
          <button
            onClick={() => setClosingReport(null)}
            className="absolute right-3 top-3 text-sm text-emerald-400 hover:text-emerald-700 transition-colors leading-none cursor-pointer"
            aria-label="Cerrar"
          >
            ✕
          </button>
          <p className="text-sm font-semibold text-emerald-800">Caja cerrada correctamente</p>
          <p className="text-xs text-emerald-600">
            Período: {new Date(closingReport.fromDate).toLocaleDateString("es-AR")} — {new Date(closingReport.toDate).toLocaleDateString("es-AR")}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-emerald-700">
            <span>
              Total: <span className="font-mono font-semibold">${Number(closingReport.totalCollected).toLocaleString("es-AR")}</span>
              <span className="text-emerald-500 ml-1">({closingReport.paidCount} cuota{closingReport.paidCount !== 1 ? "s" : ""})</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-emerald-600">
            {closingReport.efectivoCount > 0 && (
              <span>Efectivo: <span className="font-mono font-semibold">${Number(closingReport.efectivoTotal).toLocaleString("es-AR")}</span> ({closingReport.efectivoCount})</span>
            )}
            {closingReport.transferenciaCount > 0 && (
              <span>Transferencia: <span className="font-mono font-semibold">${Number(closingReport.transferenciaTotal).toLocaleString("es-AR")}</span> ({closingReport.transferenciaCount})</span>
            )}
            {closingReport.tarjetaCount > 0 && (
              <span>Tarjeta: <span className="font-mono font-semibold">${Number(closingReport.tarjetaTotal).toLocaleString("es-AR")}</span> ({closingReport.tarjetaCount})</span>
            )}
          </div>
        </div>
      )}

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
          {
            key: "name",
            header: "Alumno",
            render: (p) => (
              <span className="font-medium text-[#111110]">{p.student.firstName} {p.student.lastName}</span>
            ),
          },
          {
            key: "due",
            header: "Vencimiento",
            render: (p) => (
              <span className="text-[#68685F]">{dueDate(period, p.student.dueDay).toLocaleDateString("es-AR")}</span>
            ),
          },
          {
            key: "amount",
            header: "Monto",
            align: "right",
            render: (p) => (
              <span className="font-mono font-medium text-[#111110]">${Number(p.amount).toLocaleString("es-AR")}</span>
            ),
          },
          {
            key: "status",
            header: "Estado",
            render: (p) => (
              <div className="flex flex-col gap-0.5">
                <StatusDot dotColor={STATUS_DOT[p.status]} textColor={STATUS_TEXT[p.status]} label={STATUS_LABEL[p.status]} />
                {p.verified && (
                  <span className="text-[10px] text-[#A5A49D]">Verificado</span>
                )}
              </div>
            ),
          },
          {
            key: "paidAt",
            header: "Fecha de pago",
            render: (p) => (
              <span className="text-[#A5A49D]">
                {p.paidAt ? new Date(p.paidAt).toLocaleDateString("es-AR") : "—"}
              </span>
            ),
          },
          {
            key: "method",
            header: "Método",
            render: (p) => (
              <span className="text-sm text-[#68685F]">
                {p.paymentMethod ? METHOD_LABEL[p.paymentMethod] : "—"}
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            align: "right",
            render: (p) => {
              const busy = updatingId === p.id

              // Verified payments — no actions
              if (p.verified) {
                return <span className="text-xs text-[#A5A49D]">Verificado</span>
              }

              // PAID — show unmark button
              if (p.status === "PAID") {
                return (
                  <Button variant="danger" onClick={() => setConfirmUnpayId(p.id)} disabled={busy}>
                    {busy ? "…" : "Desmarcar pagado"}
                  </Button>
                )
              }

              // PENDING / EXPIRED — show "Marcar pagado"
              return (
                <Button
                  variant="link"
                  onClick={() => setPayMethodForId(p.id)}
                  disabled={busy}
                  className="disabled:opacity-40"
                >
                  {busy ? "…" : "Marcar pagado"}
                </Button>
              )
            },
          },
        ]}
        data={displayed}
        loading={loading}
        emptyMessage={search ? "Sin resultados para esa búsqueda." : "No hay alumnos inscriptos en este período."}
        emptyHint={!search ? "Las cuotas se generan automáticamente cuando hay alumnos inscriptos en grupos." : undefined}
        minWidth="700px"
        rowKey={(p) => p.id}
      />

      <ConfirmDialog
        open={confirmUnpayId !== null}
        title="Desmarcar como pagado"
        message="Esta cuota volverá al estado Pendiente y se borrará la fecha de pago. ¿Querés continuar?"
        confirmLabel="Desmarcar"
        onConfirm={() => { if (confirmUnpayId) handleUnmarkPaid(confirmUnpayId) }}
        onCancel={() => setConfirmUnpayId(null)}
      />

      <ConfirmDialog
        open={showClosingConfirm}
        title="Cerrar caja"
        message={closingError ? (
          <div className="space-y-3">
            {closingMessage}
            <p className="text-sm font-medium text-red-600">⚠ {closingError}</p>
          </div>
        ) : closingMessage}
        confirmLabel={closingSubmitting ? "Cerrando…" : "Confirmar cierre"}
        confirmVariant="primary"
        onConfirm={handleCashClosing}
        onCancel={() => { setShowClosingConfirm(false); setClosingError(null) }}
      />

      {/* Modal: seleccionar método de pago */}
      {payMethodForId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
          <div className="relative w-full max-w-sm rounded-2xl border border-[#E5E4E0] bg-white px-6 py-6 shadow-xl space-y-5">
            <div className="space-y-1.5">
              <p className="text-[15px] font-semibold text-[#111110]">Registrar pago</p>
              {payMethodPayment && (
                <p className="text-sm text-[#68685F]">
                  {payMethodPayment.student.firstName} {payMethodPayment.student.lastName} — <span className="font-mono font-semibold">${Number(payMethodPayment.amount).toLocaleString("es-AR")}</span>
                </p>
              )}
              <p className="text-sm text-[#A5A49D]">Seleccioná el método de pago:</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {METHOD_BUTTONS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => handleMarkPaid(payMethodForId, m.value)}
                  disabled={updatingId === payMethodForId}
                  className="flex flex-col items-center gap-2 rounded-xl border border-[#E5E4E0] bg-white px-3 py-4 text-sm font-medium text-[#68685F] hover:border-[#111110] hover:text-[#111110] hover:bg-[#FAFAF9] transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {m.value === "EFECTIVO" && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                      <path fillRule="evenodd" d="M1 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4Zm12 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm13-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM1.75 14.5a.75.75 0 0 0 0 1.5c4.417 0 8.693.603 12.749 1.73 1.111.309 2.251-.512 2.251-1.696v-.784a.75.75 0 0 0-1.5 0v.784a.272.272 0 0 1-.35.25A49.043 49.043 0 0 0 1.75 14.5Z" clipRule="evenodd" />
                    </svg>
                  )}
                  {m.value === "TRANSFERENCIA" && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                      <path d="M13.024 9.25c.47 0 .827-.433.637-.863a4 4 0 0 0-4.094-2.364c-.468.05-.665.576-.43.984l1.08 1.868a.75.75 0 0 0 .649.375h2.158ZM7.84 7.758c-.236-.408-.79-.5-1.068-.12A3.982 3.982 0 0 0 6 10c0 .884.287 1.7.772 2.363.278.38.832.287 1.068-.12l1.078-1.868a.75.75 0 0 0 0-.75L7.839 7.758ZM9.138 12.993c-.235.408-.039.934.43.984a4 4 0 0 0 4.094-2.364c.19-.43-.168-.863-.638-.863h-2.158a.75.75 0 0 0-.65.375l-1.078 1.868Z" />
                      <path fillRule="evenodd" d="M14.13 4.347l.644-1.117a.75.75 0 0 0-1.299-.75l-.644 1.116a20.944 20.944 0 0 0-5.662 0L6.525 2.48a.75.75 0 0 0-1.3.75l.645 1.117A20.943 20.943 0 0 0 1 10c0 1.68.211 3.31.6 4.866h.159c2.742 0 5.39-.472 7.84-1.339a21.489 21.489 0 0 0 7.842 1.339h.158c.39-1.556.601-3.186.601-4.866 0-2.07-.338-4.06-.958-5.924l-.112.27Zm-3.788 1.903a.75.75 0 0 0-1.299-.75l-1.28 2.217a.75.75 0 0 0 0 .75l1.28 2.217a.75.75 0 0 0 1.3-.75L9.262 8l1.08-1.867v.117ZM3.5 10a6.5 6.5 0 0 1 6.5-6.5c.834 0 1.64.158 2.377.446a.75.75 0 1 0 .523-1.406A7.956 7.956 0 0 0 10 2a8 8 0 1 0 7.934 7.071.75.75 0 1 0-1.49.178A6.5 6.5 0 0 1 3.5 10Z" clipRule="evenodd" />
                    </svg>
                  )}
                  {m.value === "TARJETA" && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                      <path fillRule="evenodd" d="M2.5 4A1.5 1.5 0 0 0 1 5.5V6h18v-.5A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1v6A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5v-6ZM3 13.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm4.75-.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" clipRule="evenodd" />
                    </svg>
                  )}
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-1">
              <Button variant="secondary" onClick={() => setPayMethodForId(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
