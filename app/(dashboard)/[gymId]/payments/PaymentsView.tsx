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
type PaymentMethod = "CASH" | "TRANSFER" | "CARD"

type Payment = {
  id: string
  amount: string
  status: PaymentStatus
  paidAt: string | null
  paymentMethod: PaymentMethod | null
  verified: boolean
  cashClosingId: string | null
  student: { id: string; firstName: string; lastName: string; dueDay: number; phone1: string }
}

type ClosingReport = {
  totalCollected: string
  paidCount: number
  cashCount: number
  cashTotal: string
  transferCount: number
  transferTotal: string
  cardCount: number
  cardTotal: string
  fromDate: string
  toDate: string
}

const STATUS_LABEL: Record<PaymentStatus, string> = { PAID: "Pagado", PENDING: "Pendiente", EXPIRED: "Vencido" }
const STATUS_DOT: Record<PaymentStatus, string> = { PAID: "bg-emerald-500", PENDING: "bg-amber-400", EXPIRED: "bg-red-500" }
const STATUS_TEXT: Record<PaymentStatus, string> = { PAID: "text-emerald-700", PENDING: "text-amber-700", EXPIRED: "text-red-700" }

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  TRANSFER: "Transferencia",
  CARD: "Tarjeta",
}

const METHOD_BUTTONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Efectivo" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CARD", label: "Tarjeta" },
]

function dueDate(period: string, dueDay: number): Date {
  const [year, month] = period.split("-").map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(dueDay, lastDay))
}

function toYearMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number)
  const d = new Date(y, m - 1)
  return d.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

function whatsappUrl(phone: string, message: string): string {
  const clean = phone.replace(/[\s\-()]/g, "")
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(clean)}&text=${encodeURIComponent(message)}`
}

function buildWhatsAppMessage(p: Payment, period: string, gymName: string): string {
  const name = p.student.firstName
  const monto = `$${Number(p.amount).toLocaleString("es-AR")}`
  const mes = periodLabel(period)

  if (p.status === "EXPIRED") {
    const due = dueDate(period, p.student.dueDay)
    const now = new Date()
    const daysLate = Math.floor((now.getTime() - due.getTime()) / 86400000)
    const fechaVenc = due.toLocaleDateString("es-AR")
    const atrasoTexto = daysLate === 1 ? "1 día de atraso" : `${daysLate} días de atraso`

    return `🏋️ *${gymName}* — Aviso automático\n\n¡Hola ${name}! 👋\n\nTe escribimos para avisarte que tu cuota de *${mes}* por *${monto}* venció el *${fechaVenc}* (${atrasoTexto}) 📅\n\nTe pedimos que puedas regularizar tu situación cuando te sea posible 🙏\n\nSi ya realizaste el pago o tenés alguna duda, no dudes en escribirnos. ¡Estamos para ayudarte! 😊\n\n¡Gracias! 💪`
  }

  const due = dueDate(period, p.student.dueDay)
  const now = new Date()
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86400000)
  const fechaVenc = due.toLocaleDateString("es-AR")
  const diasTexto = diffDays > 0 ? `faltan ${diffDays} día${diffDays !== 1 ? "s" : ""}` : "vence hoy"

  return `🏋️ *${gymName}* — Aviso automático\n\n¡Hola ${name}! 👋\n\nTe recordamos que tu cuota de *${mes}* por *${monto}* vence el *${fechaVenc}* (${diasTexto}) ⏰\n\nSi ya realizaste el pago podés ignorar este mensaje 😊\n\nAnte cualquier duda estamos a disposición. ¡Gracias! 💪`
}

export default function PaymentsView({ gymId }: { gymId: string }) {
  const now = new Date()
  const maxPeriod = toYearMonth(now)
  const [period, setPeriod] = useState(maxPeriod)
  const [minPeriod, setMinPeriod] = useState<string | undefined>(undefined)
  const [gymName, setGymName] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/gyms/${gymId}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Error al cargar el gimnasio.")
        return r.json()
      })
      .then((g) => {
        if (g?.createdAt) setMinPeriod(toYearMonth(new Date(g.createdAt)))
        if (g?.name) setGymName(g.name)
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return
      })
    return () => controller.abort()
  }, [gymId])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  type SortKey = "name" | "amount" | "due" | "status"
  const [sortKey, setSortKey] = useState<SortKey>("status")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // Payment method modal state
  const [payMethodForId, setPayMethodForId] = useState<string | null>(null)
  const payMethodPayment = payMethodForId ? payments.find((p) => p.id === payMethodForId) : null

  // Unmark confirmation
  const [confirmUnpayId, setConfirmUnpayId] = useState<string | null>(null)

  // Cash closing state
  const [showClosingConfirm, setShowClosingConfirm] = useState(false)
  const [closingSubmitting, setClosingSubmitting] = useState(false)
  const [closingReport, setClosingReport] = useState<ClosingReport | null>(null)

  // Undo closing state
  const [hasClosings, setHasClosings] = useState(false)
  const [showUndoConfirm, setShowUndoConfirm] = useState(false)
  const [undoSubmitting, setUndoSubmitting] = useState(false)
  const [undoError, setUndoError] = useState<string | null>(null)

  // Payment list inside closing dialog
  const [expandPaymentList, setExpandPaymentList] = useState(false)
  const [paymentListSearch, setPaymentListSearch] = useState("")
  const [excludedPaymentIds, setExcludedPaymentIds] = useState<Set<string>>(new Set())
  const [showExclusionConfirm, setShowExclusionConfirm] = useState(false)

  const [mutationError, setMutationError] = useState<string | null>(null)
  const [closingError, setClosingError] = useState<string | null>(null)

  const fetchHasClosings = useCallback(async () => {
    try {
      const res = await fetch(`/api/cash-closings?gymId=${gymId}`)
      if (res.ok) {
        const list = await res.json()
        setHasClosings(Array.isArray(list) && list.length > 0)
      }
    } catch { /* silencioso */ }
  }, [gymId])

  useEffect(() => { fetchHasClosings() }, [fetchHasClosings])

  useEffect(() => {
    if (showClosingConfirm) {
      setExpandPaymentList(false)
      setPaymentListSearch("")
      setExcludedPaymentIds(new Set())
    }
  }, [showClosingConfirm])

  const fetchPayments = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setMutationError(null)
    try {
      const res = await fetch(`/api/payments?gymId=${gymId}&period=${period}`, { signal })
      if (!res.ok) { setPayments([]); setMutationError("No se pudieron cargar los pagos."); return }
      const data = await res.json()
      if (Array.isArray(data) && data.length === 0) {
        const genRes = await fetch("/api/payments", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gymId, period }),
          signal,
        })
        const genData = await genRes.json()
        setPayments(genRes.ok ? genData : [])
        if (!genRes.ok) setMutationError("No se pudieron cargar los pagos.")
      } else {
        setPayments(data)
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      setMutationError("Error de conexión. Intentá de nuevo.")
      setPayments([])
    } finally {
      setLoading(false)
    }
  }, [gymId, period])

  useEffect(() => {
    const controller = new AbortController()
    fetchPayments(controller.signal)
    return () => controller.abort()
  }, [fetchPayments])

  async function handleMarkPaid(id: string, method: PaymentMethod) {
    setPayMethodForId(null)
    setMutationError(null)
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/payments/${id}?gymId=${gymId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID", paidAt: new Date().toISOString(), paymentMethod: method }),
      })
      if (res.ok) {
        const updated = await res.json()
        setPayments((prev) => prev.map((p) => (p.id === id ? updated : p)))
      } else {
        const data = await res.json().catch(() => ({}))
        setMutationError(data?.error ?? "No se pudo actualizar el pago.")
      }
    } catch {
      setMutationError("Error de conexión. Intentá de nuevo.")
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleUnmarkPaid(id: string) {
    setConfirmUnpayId(null)
    setMutationError(null)
    setUpdatingId(id)
    try {
      const res = await fetch(`/api/payments/${id}?gymId=${gymId}`, { method: "DELETE" })
      if (res.ok) {
        // Regenerate so the student reappears as PENDING
        await fetch("/api/payments", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gymId, period }),
        })
        await fetchPayments()
      } else {
        const data = await res.json().catch(() => ({}))
        setMutationError(data?.error ?? "No se pudo actualizar el pago.")
      }
    } catch {
      setMutationError("Error de conexión. Intentá de nuevo.")
    } finally {
      setUpdatingId(null)
    }
  }

  async function handleUndoCashClosing() {
    setUndoSubmitting(true)
    setUndoError(null)
    try {
      const res = await fetch(`/api/cash-closings?gymId=${gymId}`, { method: "DELETE" })
      if (res.ok) {
        setShowUndoConfirm(false)
        await fetchHasClosings()
        await fetchPayments()
      } else {
        const data = await res.json().catch(() => ({}))
        setUndoError(data?.error ?? "No se pudo deshacer la confirmación.")
      }
    } catch {
      setUndoError("Error de conexión. Intentá de nuevo.")
    }
    setUndoSubmitting(false)
  }

  function handleClosingConfirmClick() {
    if (excludedPaymentIds.size > 0) {
      setShowExclusionConfirm(true)
    } else {
      handleCashClosing()
    }
  }

  async function handleCashClosing() {
    setShowExclusionConfirm(false)
    setClosingSubmitting(true)
    setClosingError(null)
    try {
      const res = await fetch("/api/cash-closings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId,
          ...(excludedPaymentIds.size > 0 ? { excludedPaymentIds: Array.from(excludedPaymentIds) } : {}),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setClosingReport({
          totalCollected: data.totalCollected,
          paidCount: data.paidCount,
          cashCount: data.cashCount,
          cashTotal: data.cashTotal,
          transferCount: data.transferCount,
          transferTotal: data.transferTotal,
          cardCount: data.cardCount,
          cardTotal: data.cardTotal,
          fromDate: data.fromDate,
          toDate: data.toDate,
        })
        setShowClosingConfirm(false)
        await fetchHasClosings()
        await fetchPayments()
      } else {
        setClosingError(data?.error ?? "No se pudieron confirmar los pagos.")
      }
    } catch {
      setClosingError("Error de conexión. Intentá de nuevo.")
    }
    setClosingSubmitting(false)
  }

  // Orden asc: verificado(0) → pagado sin verificar(1) → pendiente(2) → vencido(3)
  // Orden desc (default): vencido → pendiente → pagado sin verificar → pagado verificado
  function statusSortKey(p: Payment): number {
    if (p.status === "EXPIRED") return 3
    if (p.status === "PENDING") return 2
    if (p.status === "PAID" && !p.verified) return 1
    return 0 // PAID + verified
  }
  const displayed = payments
    .filter((p) => `${p.student.firstName} ${p.student.lastName}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === "name") cmp = `${a.student.lastName} ${a.student.firstName}`.localeCompare(`${b.student.lastName} ${b.student.firstName}`)
      else if (sortKey === "amount") cmp = Number(a.amount) - Number(b.amount)
      else if (sortKey === "due") cmp = dueDate(period, a.student.dueDay).getTime() - dueDate(period, b.student.dueDay).getTime()
      else if (sortKey === "status") cmp = statusSortKey(a) - statusSortKey(b)
      return sortDir === "asc" ? cmp : -cmp
    })

  const paid = payments.filter((p) => p.status === "PAID").length
  const pending = payments.filter((p) => p.status === "PENDING").length
  const expired = payments.filter((p) => p.status === "EXPIRED").length
  const collected = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + Number(p.amount), 0)
  const pendingAmount = payments.filter((p) => p.status === "PENDING").reduce((sum, p) => sum + Number(p.amount), 0)
  const expiredAmount = payments.filter((p) => p.status === "EXPIRED").reduce((sum, p) => sum + Number(p.amount), 0)
  const uncollectedAmount = pendingAmount + expiredAmount
  const total = collected + uncollectedAmount
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

  const includedInClosing = unverifiedPaid.filter((p) => !excludedPaymentIds.has(p.id))
  const includedCollected = includedInClosing.reduce((sum, p) => sum + Number(p.amount), 0)
  const paymentListFiltered = unverifiedPaid.filter((p) =>
    `${p.student.firstName} ${p.student.lastName}`.toLowerCase().includes(paymentListSearch.toLowerCase())
  )

  const closingMessage = (
    <div className="space-y-3">
      <p>
        Se confirmarán <span className="font-semibold">{includedInClosing.length}</span> pago{includedInClosing.length !== 1 ? "s" : ""} cobrado{includedInClosing.length !== 1 ? "s" : ""}.
        {excludedPaymentIds.size > 0 && (
          <span className="text-amber-600"> ({excludedPaymentIds.size} excluido{excludedPaymentIds.size !== 1 ? "s" : ""})</span>
        )}
      </p>
      <div className="rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] p-3 space-y-2">
        {(["CASH", "TRANSFER", "CARD"] as PaymentMethod[]).map((method) => {
          const included = includedInClosing.filter((p) => p.paymentMethod === method)
          if (included.length === 0) return null
          const total = included.reduce((s, p) => s + Number(p.amount), 0)
          return (
            <div key={method} className="flex items-center justify-between text-sm">
              <span className="text-[#68685F]">{METHOD_LABEL[method]} ({included.length})</span>
              <span className="font-mono font-semibold text-[#111110]">${total.toLocaleString("es-AR")}</span>
            </div>
          )
        })}
        <div className="border-t border-[#E5E4E0] pt-2 flex items-center justify-between text-sm font-semibold">
          <span className="text-[#111110]">Total ({includedInClosing.length})</span>
          <span className="font-mono text-[#111110]">${includedCollected.toLocaleString("es-AR")}</span>
        </div>
      </div>

      {/* Desplegable de pagos */}
      <div className="rounded-lg border border-[#E5E4E0] overflow-hidden">
        <button
          type="button"
          onClick={() => setExpandPaymentList((v) => !v)}
          className={`w-full flex items-center justify-between gap-2 px-4 py-3 text-sm font-semibold transition-colors cursor-pointer ${expandPaymentList ? "bg-[#F5F4F0] text-[#111110]" : "bg-[#FAFAF9] text-[#68685F] hover:bg-[#F5F4F0] hover:text-[#111110]"}`}
        >
          <span className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4 opacity-60">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 6.5a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Zm.75-3.25a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z" clipRule="evenodd" />
            </svg>
            {expandPaymentList ? "Ocultar" : "Ver"} detalle de pagos
            <span className="rounded-full bg-[#E5E4E0] px-2 py-0.5 text-xs font-medium text-[#68685F]">{unverifiedPaid.length}</span>
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"
            className={`h-4 w-4 transition-transform ${expandPaymentList ? "rotate-180" : ""}`}
          >
            <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>

        {expandPaymentList && (
          <div className="border-t border-[#E5E4E0] p-3 space-y-2">
            <input
              type="text"
              placeholder="Buscar alumno…"
              value={paymentListSearch}
              onChange={(e) => setPaymentListSearch(e.target.value)}
              className="w-full rounded-lg border border-[#E5E4E0] bg-white px-3 py-1.5 text-sm text-[#111110] placeholder:text-[#A5A49D] outline-none focus:border-[#111110] transition-colors"
            />
            <div className="max-h-52 overflow-y-auto rounded-lg border border-[#E5E4E0] bg-white divide-y divide-[#F0EFEB]">
              {paymentListFiltered.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[#A5A49D]">Sin resultados.</p>
              ) : (
                paymentListFiltered.map((p) => {
                  const excluded = excludedPaymentIds.has(p.id)
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-[#FAFAF9] transition-colors ${excluded ? "opacity-40" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={!excluded}
                        onChange={(e) => {
                          setExcludedPaymentIds((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.delete(p.id)
                            else next.add(p.id)
                            return next
                          })
                        }}
                        className="h-3.5 w-3.5 rounded accent-[#111110] cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="block text-xs font-medium text-[#111110] truncate">
                          {p.student.firstName} {p.student.lastName}
                        </span>
                        {p.paidAt && (
                          <span className="text-[10px] text-[#A5A49D]">
                            {new Date(p.paidAt).toLocaleDateString("es-AR")}
                          </span>
                        )}
                      </div>
                      {p.paymentMethod && (
                        <span className="text-[10px] text-[#A5A49D] shrink-0">{METHOD_LABEL[p.paymentMethod]}</span>
                      )}
                      <span className="text-xs font-mono font-semibold text-[#111110] shrink-0">
                        ${Number(p.amount).toLocaleString("es-AR")}
                      </span>
                    </label>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-[#A5A49D]">Los pagos confirmados no podrán modificarse.</p>
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
                Confirmar pagos
              </button>
              {!hasUnverifiedPaid && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max max-w-[220px] rounded-lg bg-[#111110] px-3 py-2 text-xs text-white text-center z-10">
                  No hay pagos cobrados sin verificar
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111110]" />
                </div>
              )}
            </div>
            <div className="relative group">
              <button
                onClick={() => setShowUndoConfirm(true)}
                disabled={!hasClosings}
                className="inline-flex items-center gap-2 rounded-lg border border-[#E5E4E0] bg-white px-4 py-2.5 text-sm font-semibold text-[#68685F] hover:bg-[#FAFAF9] hover:border-[#111110] hover:text-[#111110] transition-colors min-h-[44px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-[#E5E4E0] disabled:hover:text-[#68685F]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 0 1-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 0 1 0 10.75H10.75a.75.75 0 0 1 0-1.5h2.875a3.875 3.875 0 0 0 0-7.75H3.622l4.146 3.957a.75.75 0 0 1-1.036 1.085l-5.5-5.25a.75.75 0 0 1 0-1.085l5.5-5.25a.75.75 0 0 1 1.06.025Z" clipRule="evenodd" />
                </svg>
                Deshacer última confirmación
              </button>
              {!hasClosings && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max max-w-[220px] rounded-lg bg-[#111110] px-3 py-2 text-xs text-white text-center z-10">
                  No hay confirmaciones registradas
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111110]" />
                </div>
              )}
            </div>
            <Input
              type="month"
              value={period}
              min={minPeriod}
              max={maxPeriod}
              onChange={(e) => {
                let v = e.target.value
                if (v > maxPeriod) v = maxPeriod
                if (minPeriod && v < minPeriod) v = minPeriod
                setPeriod(v)
              }}
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
          <p className="text-sm font-semibold text-emerald-800">Pagos confirmados correctamente</p>
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
            {closingReport.cashCount > 0 && (
              <span>Efectivo: <span className="font-mono font-semibold">${Number(closingReport.cashTotal).toLocaleString("es-AR")}</span> ({closingReport.cashCount})</span>
            )}
            {closingReport.transferCount > 0 && (
              <span>Transferencia: <span className="font-mono font-semibold">${Number(closingReport.transferTotal).toLocaleString("es-AR")}</span> ({closingReport.transferCount})</span>
            )}
            {closingReport.cardCount > 0 && (
              <span>Tarjeta: <span className="font-mono font-semibold">${Number(closingReport.cardTotal).toLocaleString("es-AR")}</span> ({closingReport.cardCount})</span>
            )}
          </div>
        </div>
      )}

      {mutationError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {mutationError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={payments.length} subtitle={`$${total.toLocaleString("es-AR")}`} />
        <StatCard label="Pagados" value={paid} valueColor="text-emerald-700" subtitle={`$${collected.toLocaleString("es-AR")}`} />
        <StatCard label="Pendientes" value={pending} valueColor="text-amber-700" subtitle={`$${pendingAmount.toLocaleString("es-AR")}`} />
        <StatCard label="Vencidos" value={expired} valueColor="text-red-700" subtitle={`$${expiredAmount.toLocaleString("es-AR")}`} />
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
            render: (p) => {
              const daysLate = p.status === "EXPIRED"
                ? Math.floor((new Date().getTime() - dueDate(period, p.student.dueDay).getTime()) / 86400000)
                : null
              return (
                <div className="flex flex-col gap-0.5">
                  {daysLate !== null ? (
                    <div className="relative group w-fit">
                      <StatusDot dotColor={STATUS_DOT[p.status]} textColor={STATUS_TEXT[p.status]} label={STATUS_LABEL[p.status]} />
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-max rounded-lg bg-[#111110] px-3 py-1.5 text-xs text-white z-10">
                        Vencido hace {daysLate === 1 ? "1 día" : `${daysLate} días`}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111110]" />
                      </div>
                    </div>
                  ) : (
                    <StatusDot dotColor={STATUS_DOT[p.status]} textColor={STATUS_TEXT[p.status]} label={STATUS_LABEL[p.status]} />
                  )}
                  {p.verified && (
                    <span className="text-[10px] text-[#A5A49D]">Verificado</span>
                  )}
                </div>
              )
            },
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

              // PENDING / EXPIRED — show "Marcar pagado" + WhatsApp
              return (
                <div className="flex items-center gap-2 justify-end">
                  {p.student.phone1 && (
                    <a
                      href={whatsappUrl(p.student.phone1, buildWhatsAppMessage(p, period, gymName))}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Enviar recordatorio por WhatsApp"
                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4.5 w-4.5">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </a>
                  )}
                  <Button
                    variant="link"
                    onClick={() => setPayMethodForId(p.id)}
                    disabled={busy}
                    className="disabled:opacity-40"
                  >
                    {busy ? "…" : "Marcar pagado"}
                  </Button>
                </div>
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
        open={showUndoConfirm}
        title="Deshacer última confirmación"
        message={undoError ? (
          <div className="space-y-3">
            <p>La última confirmación de pagos será eliminada. Todos los pagos que habían sido verificados volverán a aparecer como cobrados sin confirmar y podrán modificarse nuevamente, como si nunca se hubiera confirmado.</p>
            <p className="text-sm font-medium text-red-600">⚠ {undoError}</p>
          </div>
        ) : "La última confirmación de pagos será eliminada. Todos los pagos que habían sido verificados volverán a aparecer como cobrados sin confirmar y podrán modificarse nuevamente, como si nunca se hubiera confirmado."}
        confirmLabel={undoSubmitting ? "Deshaciendo…" : "Continuar"}
        confirmVariant="danger"
        onConfirm={handleUndoCashClosing}
        onCancel={() => { setShowUndoConfirm(false); setUndoError(null) }}
      />

      <ConfirmDialog
        open={showClosingConfirm}
        title="Confirmar pagos"
        message={closingError ? (
          <div className="space-y-3">
            {closingMessage}
            <p className="text-sm font-medium text-red-600">⚠ {closingError}</p>
          </div>
        ) : closingMessage}
        confirmLabel={closingSubmitting ? "Confirmando…" : "Confirmar pagos"}
        confirmVariant="primary"
        onConfirm={handleClosingConfirmClick}
        onCancel={() => { setShowClosingConfirm(false); setClosingError(null) }}
        panelClassName="max-w-lg sm:max-w-2xl"
      />

      <ConfirmDialog
        open={showExclusionConfirm}
        title="Confirmar pagos con exclusiones"
        message={
          <div className="space-y-3">
            <p>
              Se confirmarán <span className="font-semibold">{includedInClosing.length}</span> pago{includedInClosing.length !== 1 ? "s" : ""}.
              Los siguientes <span className="font-semibold">{excludedPaymentIds.size}</span> pago{excludedPaymentIds.size !== 1 ? "s" : ""} quedarán excluidos y podrán confirmarse más adelante:
            </p>
            <div className="rounded-lg border border-[#E5E4E0] bg-[#FAFAF9] p-3 space-y-1 max-h-40 overflow-y-auto">
              {unverifiedPaid.filter((p) => excludedPaymentIds.has(p.id)).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-[#68685F]">{p.student.firstName} {p.student.lastName}</span>
                  <span className="font-mono font-semibold text-[#111110]">${Number(p.amount).toLocaleString("es-AR")}</span>
                </div>
              ))}
            </div>
          </div>
        }
        confirmLabel="Continuar"
        confirmVariant="primary"
        onConfirm={handleCashClosing}
        onCancel={() => setShowExclusionConfirm(false)}
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
                  {m.value === "CASH" && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                      <path fillRule="evenodd" d="M1 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4Zm12 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm13-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM1.75 14.5a.75.75 0 0 0 0 1.5c4.417 0 8.693.603 12.749 1.73 1.111.309 2.251-.512 2.251-1.696v-.784a.75.75 0 0 0-1.5 0v.784a.272.272 0 0 1-.35.25A49.043 49.043 0 0 0 1.75 14.5Z" clipRule="evenodd" />
                    </svg>
                  )}
                  {m.value === "TRANSFER" && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6">
                      <path d="M13.024 9.25c.47 0 .827-.433.637-.863a4 4 0 0 0-4.094-2.364c-.468.05-.665.576-.43.984l1.08 1.868a.75.75 0 0 0 .649.375h2.158ZM7.84 7.758c-.236-.408-.79-.5-1.068-.12A3.982 3.982 0 0 0 6 10c0 .884.287 1.7.772 2.363.278.38.832.287 1.068-.12l1.078-1.868a.75.75 0 0 0 0-.75L7.839 7.758ZM9.138 12.993c-.235.408-.039.934.43.984a4 4 0 0 0 4.094-2.364c.19-.43-.168-.863-.638-.863h-2.158a.75.75 0 0 0-.65.375l-1.078 1.868Z" />
                      <path fillRule="evenodd" d="M14.13 4.347l.644-1.117a.75.75 0 0 0-1.299-.75l-.644 1.116a20.944 20.944 0 0 0-5.662 0L6.525 2.48a.75.75 0 0 0-1.3.75l.645 1.117A20.943 20.943 0 0 0 1 10c0 1.68.211 3.31.6 4.866h.159c2.742 0 5.39-.472 7.84-1.339a21.489 21.489 0 0 0 7.842 1.339h.158c.39-1.556.601-3.186.601-4.866 0-2.07-.338-4.06-.958-5.924l-.112.27Zm-3.788 1.903a.75.75 0 0 0-1.299-.75l-1.28 2.217a.75.75 0 0 0 0 .75l1.28 2.217a.75.75 0 0 0 1.3-.75L9.262 8l1.08-1.867v.117ZM3.5 10a6.5 6.5 0 0 1 6.5-6.5c.834 0 1.64.158 2.377.446a.75.75 0 1 0 .523-1.406A7.956 7.956 0 0 0 10 2a8 8 0 1 0 7.934 7.071.75.75 0 1 0-1.49.178A6.5 6.5 0 0 1 3.5 10Z" clipRule="evenodd" />
                    </svg>
                  )}
                  {m.value === "CARD" && (
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
