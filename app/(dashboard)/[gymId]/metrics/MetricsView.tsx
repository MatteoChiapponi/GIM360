"use client"

import { useState, useEffect, useCallback } from "react"

type GymMetrics = {
  gymId: string
  period: string
  totalCollectedRevenue: number
  totalPendingRevenue: number
  totalTrainerCost: number
  totalFixedExpenses: number
  ebitda: number
}

type GroupMetrics = {
  groupId: string
  groupName: string
  monthlyPrice: number
  activeStudents: number
  maxCapacity: number | null
  occupancyRate: number | null
  projectedRevenue: number
  collectedRevenue: number
  monthlyHours: number
  trainerCost: number
  margin: number
  trainerCostNote: string | null
}

type MetricView = "general" | "gimnasio" | "grupos"

const VIEWS: { id: MetricView; label: string }[] = [
  { id: "general",  label: "General" },
  { id: "gimnasio", label: "Gimnasio" },
  { id: "grupos",   label: "Grupos" },
]

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n)
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`
}

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: string
  sub?: string
  highlight?: "positive" | "negative" | "neutral"
}) {
  const accentColor =
    highlight === "positive" ? "#10b981"
    : highlight === "negative" ? "#ef4444"
    : "#E5E4E0"

  const valueColor =
    highlight === "positive" ? "text-emerald-700"
    : highlight === "negative" ? "text-red-700"
    : "text-[#111110]"

  return (
    <div className="relative rounded-xl border border-[#E5E4E0] bg-white px-5 py-4 overflow-hidden">
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
        style={{ backgroundColor: accentColor }}
      />
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">{label}</p>
      <p className={`mt-2 text-2xl font-bold font-mono ${valueColor}`}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-[#C8C7C3]">{sub}</p>}
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
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pctVal}%` }}
        />
      </div>
    </div>
  )
}

export default function MetricsView({ gymId }: { gymId: string }) {
  const now = new Date()
  const maxPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const [period, setPeriod] = useState(maxPeriod)
  const [activeView, setActiveView] = useState<MetricView>("general")
  const [gymMetrics, setGymMetrics] = useState<GymMetrics | null>(null)
  const [groupMetrics, setGroupMetrics] = useState<GroupMetrics[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ gymId, period })
      const [gymRes, groupsRes] = await Promise.all([
        fetch(`/api/metrics/gym?${params}`),
        fetch(`/api/metrics/groups?${params}`),
      ])
      if (!gymRes.ok || !groupsRes.ok) {
        setError("Error al cargar las métricas.")
        return
      }
      const [gym, groups] = await Promise.all([gymRes.json(), groupsRes.json()])
      setGymMetrics(gym)
      setGroupMetrics(groups)
    } catch {
      setError("Error de red.")
    } finally {
      setLoading(false)
    }
  }, [gymId, period])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  const ebitdaHighlight =
    gymMetrics === null ? "neutral"
    : gymMetrics.ebitda >= 0 ? "positive"
    : "negative"

  const totalRevenue = gymMetrics
    ? gymMetrics.totalCollectedRevenue + gymMetrics.totalPendingRevenue
    : 0

  const totalGroupMargin = groupMetrics.reduce((s, g) => s + g.margin, 0)
  const totalStudents = groupMetrics.reduce((s, g) => s + g.activeStudents, 0)

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#111110]">Métricas</h1>
          <p className="mt-0.5 text-sm text-[#68685F]">Rentabilidad y costos del gimnasio</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="period" className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">
            Período
          </label>
          <input
            id="period"
            type="month"
            value={period}
            max={maxPeriod}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-[#E5E4E0] bg-white px-3 py-2 text-sm text-[#111110] focus:border-[#111110] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* View selector */}
      <div className="flex items-center gap-1 border-b border-[#E5E4E0]">
        {VIEWS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeView === id
                ? "border-[#111110] text-[#111110]"
                : "border-transparent text-[#A5A49D] hover:text-[#68685F]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-sm text-[#A5A49D]">Cargando métricas…</div>
      ) : gymMetrics ? (
        <>
          {/* ── GENERAL ──────────────────────────────────────────── */}
          {activeView === "general" && (
            <div className="space-y-6">
              {/* Top KPIs: EBITDA destacado + collected/pending */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {/* EBITDA hero card */}
                <div
                  className="relative rounded-xl border border-[#E5E4E0] bg-white px-6 py-5 overflow-hidden sm:row-span-1"
                  style={{ borderLeftColor: gymMetrics.ebitda >= 0 ? "#10b981" : "#ef4444", borderLeftWidth: 3 }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">EBITDA del período</p>
                  <p className={`mt-2 text-3xl font-bold font-mono ${gymMetrics.ebitda >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {fmt(gymMetrics.ebitda)}
                  </p>
                  <p className="mt-1 text-[11px] text-[#C8C7C3]">cobrado − entrenadores − fijos</p>
                </div>

                {/* Ingresos */}
                <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-4 space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Ingresos</p>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-[#68685F]">Cobrados</span>
                    <span className="font-mono font-semibold text-emerald-700 text-sm">{fmt(gymMetrics.totalCollectedRevenue)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-[#68685F]">Pendientes</span>
                    <span className="font-mono font-semibold text-[#111110] text-sm">{fmt(gymMetrics.totalPendingRevenue)}</span>
                  </div>
                  <div className="h-px bg-[#F0EFEB]" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-[#68685F]">Total</span>
                    <span className="font-mono font-bold text-[#111110] text-sm">{fmt(totalRevenue)}</span>
                  </div>
                </div>

                {/* Costos */}
                <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-4 space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Costos</p>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-[#68685F]">Entrenadores</span>
                    <span className="font-mono font-semibold text-red-700 text-sm">{fmt(gymMetrics.totalTrainerCost)}</span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-[#68685F]">Gastos fijos</span>
                    <span className="font-mono font-semibold text-red-700 text-sm">{fmt(gymMetrics.totalFixedExpenses)}</span>
                  </div>
                  <div className="h-px bg-[#F0EFEB]" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-[#68685F]">Total</span>
                    <span className="font-mono font-bold text-red-700 text-sm">{fmt(gymMetrics.totalTrainerCost + gymMetrics.totalFixedExpenses)}</span>
                  </div>
                </div>
              </div>

              {/* Progreso de cobro */}
              {totalRevenue > 0 && (
                <CollectionProgress collected={gymMetrics.totalCollectedRevenue} total={totalRevenue} />
              )}

              {/* Resumen de grupos (solo totales) */}
              {groupMetrics.length > 0 && (
                <div className="rounded-xl border border-[#E5E4E0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#F0EFEB] flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">
                      Grupos · resumen
                    </p>
                    <button
                      onClick={() => setActiveView("grupos")}
                      className="text-xs font-medium text-[#68685F] hover:text-[#111110] transition-colors"
                    >
                      Ver detalle →
                    </button>
                  </div>
                  <div className="divide-y divide-[#F7F6F3]">
                    {groupMetrics.map((g) => (
                      <div key={g.groupId} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-medium text-[#111110]">{g.groupName}</p>
                          <p className="text-xs text-[#A5A49D]">{g.activeStudents} alumnos</p>
                        </div>
                        <span className={`text-sm font-mono font-semibold ${g.margin >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {fmt(g.margin)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-5 py-3 bg-[#F7F6F3]">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-[#68685F]">Total</p>
                        <p className="text-xs text-[#A5A49D]">{totalStudents} alumnos</p>
                      </div>
                      <span className={`text-sm font-mono font-bold ${totalGroupMargin >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {fmt(totalGroupMargin)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── GIMNASIO ─────────────────────────────────────────── */}
          {activeView === "gimnasio" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <StatCard label="Ingresos cobrados"  value={fmt(gymMetrics.totalCollectedRevenue)} sub="pagos PAID"                highlight="positive" />
                <StatCard label="Ingresos pendientes" value={fmt(gymMetrics.totalPendingRevenue)}   sub="pagos PENDING" />
                <StatCard label="Costo entrenadores"  value={fmt(gymMetrics.totalTrainerCost)}       sub="tarifa × horas estimadas" highlight="negative" />
                <StatCard label="Gastos fijos"        value={fmt(gymMetrics.totalFixedExpenses)}     sub="alquiler, servicios, etc." highlight="negative" />
                <StatCard label="EBITDA"              value={fmt(gymMetrics.ebitda)}                 sub="cobrado − costos" highlight={ebitdaHighlight} />
              </div>

              {totalRevenue > 0 && (
                <CollectionProgress collected={gymMetrics.totalCollectedRevenue} total={totalRevenue} />
              )}
            </div>
          )}

          {/* ── GRUPOS ───────────────────────────────────────────── */}
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
                          { label: "Grupo",           align: "left" },
                          { label: "Alumnos",         align: "right" },
                          { label: "Ocupación",       align: "right" },
                          { label: "Precio/mes",      align: "right" },
                          { label: "Ing. proyectado", align: "right" },
                          { label: "Ing. cobrado",    align: "right" },
                          { label: "Hs/mes",          align: "right" },
                          { label: "Costo prof.",     align: "right" },
                          { label: "Margen",          align: "right" },
                        ].map(({ label, align }) => (
                          <th
                            key={label}
                            className={`px-4 py-3.5 text-${align} text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]`}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupMetrics.map((g, i) => (
                        <tr
                          key={g.groupId}
                          className={`hover:bg-[#FAFAF9] transition-colors ${i > 0 ? "border-t border-[#F7F6F3]" : ""}`}
                        >
                          <td className="px-4 py-4 font-medium text-[#111110]">
                            {g.groupName}
                            {g.trainerCostNote && (
                              <span className="ml-2 cursor-help text-amber-500" title={g.trainerCostNote}>⚠</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right text-[#68685F]">
                            {g.activeStudents}
                            {g.maxCapacity != null && <span className="text-[#A5A49D]"> / {g.maxCapacity}</span>}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {g.occupancyRate != null ? (
                              <span className={`font-mono font-medium ${
                                g.occupancyRate >= 0.8 ? "text-emerald-700"
                                : g.occupancyRate >= 0.5 ? "text-amber-700"
                                : "text-red-700"
                              }`}>
                                {pct(g.occupancyRate)}
                              </span>
                            ) : (
                              <span className="text-[#A5A49D]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-[#68685F]">{fmt(g.monthlyPrice)}</td>
                          <td className="px-4 py-4 text-right font-mono text-[#68685F]">{fmt(g.projectedRevenue)}</td>
                          <td className="px-4 py-4 text-right font-mono font-semibold text-[#111110]">{fmt(g.collectedRevenue)}</td>
                          <td className="px-4 py-4 text-right text-[#A5A49D]">{g.monthlyHours.toFixed(1)}h</td>
                          <td className="px-4 py-4 text-right font-mono text-red-700">{fmt(g.trainerCost)}</td>
                          <td className={`px-4 py-4 text-right font-mono font-semibold ${g.margin >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {fmt(g.margin)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#E5E4E0] bg-[#F7F6F3]">
                        <td className="px-4 py-3.5 font-semibold text-[#68685F]" colSpan={4}>Total</td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#68685F]">
                          {fmt(groupMetrics.reduce((s, g) => s + g.projectedRevenue, 0))}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#111110]">
                          {fmt(groupMetrics.reduce((s, g) => s + g.collectedRevenue, 0))}
                        </td>
                        <td className="px-4 py-3.5 text-right text-[#A5A49D]">—</td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-red-700">
                          {fmt(groupMetrics.reduce((s, g) => s + g.trainerCost, 0))}
                        </td>
                        <td className={`px-4 py-3.5 text-right font-mono font-bold ${totalGroupMargin >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {fmt(totalGroupMargin)}
                        </td>
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
