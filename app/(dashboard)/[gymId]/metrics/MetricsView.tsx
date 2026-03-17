"use client"

import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react"
import { createPortal } from "react-dom"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"

// ─── Types ────────────────────────────────────────────────────────────────────

type GymMetrics = {
  gymId: string; period: string
  totalCollectedRevenue: number; totalPendingRevenue: number
  totalTrainerCost: number; totalFixedExpenses: number; ebitda: number
}

type GroupMetrics = {
  groupId: string; groupName: string; monthlyPrice: number
  activeStudents: number; maxCapacity: number | null; occupancyRate: number | null
  projectedRevenue: number; collectedRevenue: number
  monthlyHours: number; trainerCost: number; margin: number; breakevenStudents: number | null
}

type MetricView = "gimnasio" | "grupos"

const VIEWS: { id: MetricView; label: string }[] = [
  { id: "gimnasio", label: "Gimnasio" },
  { id: "grupos", label: "Grupos" },
]

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
}

function pct(n: number) { return `${Math.round(n * 100)}%` }

// ─── Tooltip (hover on desktop, tap on mobile) ──────────────────────────────

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const visible = open || hover

  // Position the portal tooltip below the trigger
  useLayoutEffect(() => {
    if (!visible || !triggerRef.current) { setPos(null); return }
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 })
  }, [visible])

  // Close on outside click (mobile)
  useEffect(() => {
    if (!open) return
    function handleOutside(e: PointerEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return
      if (tooltipRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", handleOutside)
    return () => document.removeEventListener("pointerdown", handleOutside)
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex items-center justify-center cursor-default touch-manipulation"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label="Más información"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" className={`transition-opacity shrink-0 ${visible ? "opacity-80" : "opacity-40"}`}>
          <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1" fill="none"/>
          <text x="6" y="9" textAnchor="middle" fontSize="8" fontWeight="600">?</text>
        </svg>
      </button>
      {visible && pos && createPortal(
        <div
          ref={tooltipRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, transform: "translateX(-50%)" }}
          className="w-56 rounded-lg bg-[#111110] px-3 py-2 text-[11px] font-normal normal-case tracking-normal text-white shadow-lg z-[9999] text-left leading-relaxed"
        >
          {text}
        </div>,
        document.body
      )}
    </>
  )
}

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MetricStatCard({ label, value, tooltip, highlight }: {
  label: string; value: string; tooltip?: string; highlight?: "positive" | "negative" | "neutral"
}) {
  const accentColor = highlight === "positive" ? "#10b981" : highlight === "negative" ? "#ef4444" : "#E5E4E0"
  const valueColor = highlight === "positive" ? "text-emerald-700" : highlight === "negative" ? "text-red-700" : "text-[#111110]"

  return (
    <div className="relative rounded-xl border border-[#E5E4E0] bg-white px-5 py-4 overflow-hidden flex flex-col">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ backgroundColor: accentColor }} />
      <p className="min-h-[2rem] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D] flex items-start gap-1">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </p>
      <p className={`mt-auto text-2xl font-bold font-mono ${valueColor}`}>{value}</p>
    </div>
  )
}

function CollectionProgress({ collected, total }: { collected: number; total: number }) {
  if (total === 0) return null
  const pctVal = Math.round((collected / total) * 100)
  return (
    <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[#68685F]">
          <span className="font-semibold text-[#111110]">{fmt(collected)}</span>
          {" cobrados de "}
          <span className="text-[#A5A49D]">{fmt(total)}</span>
        </span>
        <span className="text-sm font-bold font-mono text-[#111110]">{pctVal}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F0EFEB]">
        <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pctVal}%` }} />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

function formatPeriod(period: string) {
  const [year, month] = period.split("-")
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
}

export default function MetricsView({ gymId }: { gymId: string }) {
  const now = new Date()
  const maxPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const [period, setPeriod] = useState(maxPeriod)
  const [activeView, setActiveView] = useState<MetricView>("gimnasio")
  const [gymMetrics, setGymMetrics] = useState<GymMetrics | null>(null)
  const [groupMetrics, setGroupMetrics] = useState<GroupMetrics[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ gymId, period })
      const [gymRes, groupsRes] = await Promise.all([
        fetch(`/api/metrics/gym?${params}`), fetch(`/api/metrics/groups?${params}`),
      ])
      if (!gymRes.ok || !groupsRes.ok) { setError("Error al cargar las métricas."); return }
      const [gym, groups] = await Promise.all([gymRes.json(), groupsRes.json()])
      setGymMetrics(gym); setGroupMetrics(groups)
    } catch { setError("Error de red.") }
    finally { setLoading(false) }
  }, [gymId, period])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  const ebitdaHighlight = gymMetrics === null ? "neutral" : gymMetrics.ebitda >= 0 ? "positive" : "negative"
  const totalRevenue = gymMetrics ? gymMetrics.totalCollectedRevenue + gymMetrics.totalPendingRevenue : 0
  const ebitdaMarginPct = gymMetrics && gymMetrics.totalCollectedRevenue > 0
    ? Math.round((gymMetrics.ebitda / gymMetrics.totalCollectedRevenue) * 100)
    : null
  const totalGroupMargin = groupMetrics.reduce((s, g) => s + g.margin, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold text-[#111110]">Métricas</h1>
            <span className="text-xl text-[#C8C7C3]">/</span>
            <span className="text-xl font-semibold capitalize text-[#68685F]">{formatPeriod(period)}</span>
          </div>
          <p className="mt-0.5 text-sm text-[#A5A49D]">Rentabilidad y costos del gimnasio</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="period">Mes</Label>
          <Input id="period" type="month" value={period} max={maxPeriod} onChange={(e) => setPeriod(e.target.value > maxPeriod ? maxPeriod : e.target.value)} className="py-2" />
        </div>
      </div>

      {/* View selector */}
      <div className="flex items-center gap-1 border-b border-[#E5E4E0]">
        {VIEWS.map(({ id, label }) => (
          <button key={id} onClick={() => setActiveView(id)}
            className={`cursor-pointer px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeView === id ? "border-[#111110] text-[#111110]" : "border-transparent text-[#A5A49D] hover:text-[#68685F]"
            }`}
          >{label}</button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="py-20 text-center text-sm text-[#A5A49D]">Cargando métricas…</div>
      ) : gymMetrics ? (
        <>
          {/* ── GIMNASIO ── */}
          {activeView === "gimnasio" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <MetricStatCard label="Ingresos cobrados" value={fmt(gymMetrics.totalCollectedRevenue)} tooltip="Suma de todos los pagos en estado PAGADO para el período seleccionado." highlight="positive" />
                <MetricStatCard label="Ingresos pendientes" value={fmt(gymMetrics.totalPendingRevenue)} tooltip="Suma de todos los pagos en estado PENDIENTE para el período seleccionado." />
                <MetricStatCard label="Costo entrenadores" value={fmt(gymMetrics.totalTrainerCost)} tooltip="Costo total de entrenadores: tarifa por hora × horas semanales × 4,33 semanas/mes, para cada entrenador activo." highlight="negative" />
                <MetricStatCard label="Gastos fijos" value={fmt(gymMetrics.totalFixedExpenses)} tooltip="Suma de todos los gastos fijos configurados: alquiler, servicios, seguros, etc." highlight="negative" />
                <MetricStatCard label="EBITDA" value={fmt(gymMetrics.ebitda)} tooltip="Resultado operativo: ingresos cobrados menos costo de entrenadores y gastos fijos." highlight={ebitdaHighlight} />
                <MetricStatCard label="Margen EBITDA" value={ebitdaMarginPct !== null ? `${ebitdaMarginPct}%` : "—"} tooltip="Porcentaje de ganancia (o pérdida) sobre los ingresos cobrados. Indica qué proporción del ingreso queda como resultado operativo." highlight={ebitdaHighlight} />
              </div>
              {totalRevenue > 0 && <CollectionProgress collected={gymMetrics.totalCollectedRevenue} total={totalRevenue} />}
            </div>
          )}

          {/* ── GRUPOS ── */}
          {activeView === "grupos" && (
            <div>
              {groupMetrics.length === 0 ? (
                <p className="text-sm text-[#A5A49D]">No hay grupos en este gimnasio.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#E5E4E0] bg-white">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-[#F0EFEB]">
                        {[
                          { label: "Grupo", align: "left", tooltip: null },
                          { label: "Alumnos", align: "right", tooltip: "Alumnos activos en el grupo. Si hay capacidad máxima configurada, se muestra el total." },
                          { label: "Ocupación", align: "right", tooltip: "Porcentaje de ocupación respecto a la capacidad máxima del grupo." },
                          { label: "Precio/mes", align: "right", tooltip: "Precio mensual que paga cada alumno inscripto en este grupo." },
                          { label: "Ing. proyectado", align: "right", tooltip: "Ingreso esperado si todos los alumnos activos pagaran: alumnos × precio/mes." },
                          { label: "Ing. cobrado", align: "right", tooltip: "Suma real de pagos PAGADOS en el período para este grupo." },
                          { label: "Hs/mes", align: "right", tooltip: "Horas de clase estimadas por mes, basadas en los horarios del grupo (× 4,33 semanas)." },
                          { label: "Costo prof.", align: "right", tooltip: "Costo total de los profesores: tarifa/hora × horas semanales × 4,33 semanas/mes." },
                          { label: "Punto equilibrio", align: "right", tooltip: "Mínimo de alumnos que deben pagar para cubrir el costo de los profesores. Verde si el ingreso cobrado lo supera." },
                          { label: "Margen", align: "right", tooltip: "Ingreso cobrado menos costo de profesores. No incluye gastos fijos." },
                        ].map(({ label, align, tooltip }) => (
                          <th key={label} className={`px-4 py-3.5 text-${align} text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]`}>
                            {tooltip ? (
                              <span className="inline-flex items-center gap-1 cursor-default">
                                {label}
                                <InfoTooltip text={tooltip} />
                              </span>
                            ) : label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupMetrics.map((g, i) => (
                        <tr key={g.groupId} className={`hover:bg-[#FAFAF9] transition-colors ${i > 0 ? "border-t border-[#F7F6F3]" : ""}`}>
                          <td className="px-4 py-4 font-medium text-[#111110]">{g.groupName}</td>
                          <td className="px-4 py-4 text-right text-[#68685F]">
                            {g.activeStudents}{g.maxCapacity != null && <span className="text-[#A5A49D]"> / {g.maxCapacity}</span>}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {g.occupancyRate != null ? (
                              <span className={`font-mono font-medium ${g.occupancyRate >= 0.8 ? "text-emerald-700" : g.occupancyRate >= 0.5 ? "text-amber-700" : "text-red-700"}`}>{pct(g.occupancyRate)}</span>
                            ) : <span className="text-[#A5A49D]">—</span>}
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-[#68685F]">{fmt(g.monthlyPrice)}</td>
                          <td className="px-4 py-4 text-right font-mono text-[#68685F]">{fmt(g.projectedRevenue)}</td>
                          <td className="px-4 py-4 text-right font-mono font-semibold text-[#111110]">{fmt(g.collectedRevenue)}</td>
                          <td className="px-4 py-4 text-right text-[#A5A49D]">{g.monthlyHours.toFixed(1)}h</td>
                          <td className="px-4 py-4 text-right font-mono text-red-700">{fmt(g.trainerCost)}</td>
                          <td className="px-4 py-4 text-right">
                            {g.breakevenStudents === null ? (
                              <span className="text-[#A5A49D]">—</span>
                            ) : (
                              <span className={`font-mono font-medium ${g.margin >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                {g.breakevenStudents} alumnos
                              </span>
                            )}
                          </td>
                          <td className={`px-4 py-4 text-right font-mono font-semibold ${g.margin >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(g.margin)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#E5E4E0] bg-[#F7F6F3]">
                        <td className="px-4 py-3.5 font-semibold text-[#68685F]" colSpan={4}>Total</td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#68685F]">{fmt(groupMetrics.reduce((s, g) => s + g.projectedRevenue, 0))}</td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#111110]">{fmt(groupMetrics.reduce((s, g) => s + g.collectedRevenue, 0))}</td>
                        <td className="px-4 py-3.5 text-right text-[#A5A49D]">—</td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-red-700">{fmt(groupMetrics.reduce((s, g) => s + g.trainerCost, 0))}</td>
                        <td className="px-4 py-3.5 text-right text-[#A5A49D]">—</td>
                        <td className={`px-4 py-3.5 text-right font-mono font-bold ${totalGroupMargin >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(totalGroupMargin)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
