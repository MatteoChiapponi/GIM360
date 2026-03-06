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

const STATUS_STYLES: Record<PaymentStatus, string> = {
  PAID:    "bg-green-100 text-green-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  EXPIRED: "bg-red-100 text-red-800",
}

function dueDate(period: string, dueDay: number): Date {
  const [year, month] = period.split("-").map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(dueDay, lastDay))
}

export default function PaymentsView({ gymId }: { gymId: string }) {
  const now = new Date()
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  )
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/payments?gymId=${gymId}&period=${period}`)
    const data = await res.json()
    setPayments(res.ok ? data : [])
    setLoading(false)
  }, [gymId, period])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  async function handleGenerate() {
    setGenerating(true)
    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gymId, period }),
    })
    const data = await res.json()
    if (res.ok) setPayments(data)
    setGenerating(false)
  }

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

  const paid     = payments.filter((p) => p.status === "PAID").length
  const pending  = payments.filter((p) => p.status === "PENDING").length
  const expired  = payments.filter((p) => p.status === "EXPIRED").length
  const total    = payments.reduce((sum, p) => sum + Number(p.amount), 0)
  const collected = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Pagos</h1>
          <div className="flex items-center gap-3">
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? "Generando…" : "Generar mes"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-4 gap-4">
          {[
            { label: "Total",     value: payments.length, color: "text-gray-900" },
            { label: "Pagados",   value: paid,            color: "text-green-600" },
            { label: "Pendientes",value: pending,         color: "text-yellow-600" },
            { label: "Vencidos",  value: expired,         color: "text-red-600" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Collection progress */}
        {payments.length > 0 && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex justify-between text-sm text-gray-600">
              <span>Recaudado</span>
              <span className="font-medium">
                ${collected.toLocaleString("es-AR")} / ${total.toLocaleString("es-AR")}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-green-500 transition-all"
                style={{ width: total > 0 ? `${(collected / total) * 100}%` : "0%" }}
              />
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">Cargando…</div>
          ) : payments.length === 0 ? (
            <div className="py-16 text-center text-sm text-gray-400">
              No hay pagos para este período.
              <br />
              <span className="text-xs">Hacé clic en "Generar mes" para crearlos.</span>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Alumno</th>
                  <th className="px-4 py-3">Vencimiento</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Fecha de pago</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p) => {
                  const due = dueDate(period, p.student.dueDay)
                  const busy = updatingId === p.id
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {p.student.firstName} {p.student.lastName}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {due.toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        ${Number(p.amount).toLocaleString("es-AR")}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status]}`}>
                          {STATUS_LABEL[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {p.paidAt
                          ? new Date(p.paidAt).toLocaleDateString("es-AR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.status !== "PAID" && (
                          <button
                            onClick={() => handleMarkPaid(p.id)}
                            disabled={busy}
                            className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Marcar pagado
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
