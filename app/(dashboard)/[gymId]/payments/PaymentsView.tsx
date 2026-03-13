"use client"

import { useState, useEffect, useCallback } from "react"

type PaymentStatus = "PENDING" | "PAID" | "EXPIRED"

type Payment = {
  id: string
  amount: string
  status: PaymentStatus
  paidAt: string | null
  student: { id: string; firstName: string; lastName: string; dueDay: number }
}

const STATUS_LABEL: Record<PaymentStatus, string> = {
  PAID:    "Pagado",
  PENDING: "Pendiente",
  EXPIRED: "Vencido",
}

const STATUS_DOT: Record<PaymentStatus, string> = {
  PAID:    "bg-emerald-500",
  PENDING: "bg-amber-400",
  EXPIRED: "bg-red-500",
}

const STATUS_TEXT: Record<PaymentStatus, string> = {
  PAID:    "text-emerald-700",
  PENDING: "text-amber-700",
  EXPIRED: "text-red-700",
}

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

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/payments?gymId=${gymId}&period=${period}`)
    const data = await res.json()

    if (res.ok && Array.isArray(data) && data.length === 0) {
      // No payments yet for this period — auto-generate
      const genRes = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID", paidAt: new Date().toISOString() }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)))
    }
    setUpdatingId(null)
  }

  const paid      = payments.filter((p) => p.status === "PAID").length
  const pending   = payments.filter((p) => p.status === "PENDING").length
  const expired   = payments.filter((p) => p.status === "EXPIRED").length
  const total     = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const collected = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const collectionPct = total > 0 ? Math.round((collected / total) * 100) : 0

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#111110]">Pagos</h1>
          <p className="mt-0.5 text-sm text-[#68685F]">Control de cobros mensuales</p>
        </div>
        <input
          type="month"
          value={period}
          max={maxPeriod}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-[#E5E4E0] bg-white px-3 py-2.5 text-sm text-[#111110] focus:border-[#111110] focus:outline-none transition-colors self-start"
        />
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total",      value: payments.length, color: "text-[#111110]" },
          { label: "Pagados",    value: paid,            color: "text-emerald-700" },
          { label: "Pendientes", value: pending,         color: "text-amber-700" },
          { label: "Vencidos",   value: expired,         color: "text-red-700" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[#E5E4E0] bg-white px-4 py-4 sm:px-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">{label}</p>
            <p className={`mt-2 text-2xl font-bold font-mono sm:text-3xl ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Collection progress */}
      {payments.length > 0 && (
        <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#68685F]">
              <span className="font-semibold text-[#111110]">
                ${collected.toLocaleString("es-AR")}
              </span>
              {" cobrados de "}
              <span className="text-[#A5A49D]">${total.toLocaleString("es-AR")}</span>
            </span>
            <span className="text-sm font-bold font-mono text-[#111110]">{collectionPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F0EFEB]">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${collectionPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[#E5E4E0] bg-white overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm text-[#A5A49D]">Cargando…</div>
        ) : payments.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm text-[#68685F]">No hay alumnos inscriptos en este período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[580px] text-sm">
            <thead>
              <tr className="border-b border-[#F0EFEB]">
                <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Alumno</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Vencimiento</th>
                <th className="px-5 py-3.5 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Monto</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Estado</th>
                <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Fecha de pago</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => {
                const due = dueDate(period, p.student.dueDay)
                const busy = updatingId === p.id
                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-[#FAFAF9] transition-colors ${i > 0 ? "border-t border-[#F7F6F3]" : ""}`}
                  >
                    <td className="px-5 py-4 font-medium text-[#111110]">
                      {p.student.firstName} {p.student.lastName}
                    </td>
                    <td className="px-5 py-4 text-[#68685F]">
                      {due.toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-medium text-[#111110]">
                      ${Number(p.amount).toLocaleString("es-AR")}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[p.status]}`} />
                        <span className={`text-sm font-medium ${STATUS_TEXT[p.status]}`}>
                          {STATUS_LABEL[p.status]}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[#A5A49D]">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString("es-AR") : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {p.status !== "PAID" && (
                        <button
                          onClick={() => handleMarkPaid(p.id)}
                          disabled={busy}
                          className="text-xs font-medium text-[#68685F] hover:text-[#111110] underline underline-offset-2 disabled:opacity-40 transition-colors"
                        >
                          {busy ? "…" : "Marcar pagado"}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
