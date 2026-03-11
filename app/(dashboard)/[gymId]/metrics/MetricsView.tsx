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

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
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
  const color =
    highlight === "positive"
      ? "text-green-600"
      : highlight === "negative"
      ? "text-red-600"
      : "text-gray-900"

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

export default function MetricsView({ gymId }: { gymId: string }) {
  const now = new Date()
  const [period, setPeriod] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  )
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

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  const ebitdaHighlight =
    gymMetrics === null
      ? "neutral"
      : gymMetrics.ebitda >= 0
      ? "positive"
      : "negative"

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Métricas</h1>
          <p className="text-sm text-gray-500">Rentabilidad y costos del gimnasio</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="period" className="text-sm font-medium text-gray-600">
            Período
          </label>
          <input
            id="period"
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Cargando métricas...</div>
      ) : gymMetrics ? (
        <>
          {/* Gym-level cards */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Resumen del gimnasio
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard
                label="Ingresos cobrados"
                value={fmt(gymMetrics.totalCollectedRevenue)}
                sub="pagos en estado PAID"
                highlight="positive"
              />
              <StatCard
                label="Ingresos pendientes"
                value={fmt(gymMetrics.totalPendingRevenue)}
                sub="pagos PENDING del período"
              />
              <StatCard
                label="Costo entrenadores"
                value={fmt(gymMetrics.totalTrainerCost)}
                sub="tarifa × horas estimadas"
                highlight="negative"
              />
              <StatCard
                label="Gastos fijos"
                value={fmt(gymMetrics.totalFixedExpenses)}
                sub="alquiler, servicios, etc."
                highlight="negative"
              />
              <StatCard
                label="EBITDA"
                value={fmt(gymMetrics.ebitda)}
                sub="cobrado − entrenadores − fijos"
                highlight={ebitdaHighlight}
              />
            </div>
          </section>

          {/* Collection progress */}
          {gymMetrics.totalCollectedRevenue + gymMetrics.totalPendingRevenue > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
                Progreso de cobro del período
              </h2>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>
                    {fmt(gymMetrics.totalCollectedRevenue)} cobrados de{" "}
                    {fmt(gymMetrics.totalCollectedRevenue + gymMetrics.totalPendingRevenue)} totales
                  </span>
                  <span className="font-semibold">
                    {gymMetrics.totalCollectedRevenue + gymMetrics.totalPendingRevenue > 0
                      ? pct(
                          gymMetrics.totalCollectedRevenue /
                            (gymMetrics.totalCollectedRevenue + gymMetrics.totalPendingRevenue)
                        )
                      : "0%"}
                  </span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{
                      width:
                        gymMetrics.totalCollectedRevenue + gymMetrics.totalPendingRevenue > 0
                          ? `${Math.round(
                              (gymMetrics.totalCollectedRevenue /
                                (gymMetrics.totalCollectedRevenue + gymMetrics.totalPendingRevenue)) *
                                100
                            )}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Groups table */}
          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">
              Rentabilidad por grupo
            </h2>
            {groupMetrics.length === 0 ? (
              <p className="text-sm text-gray-400">No hay grupos en este gimnasio.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Grupo</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Alumnos</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Ocupación</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Precio/mes</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">
                        Ing. proyectado
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">
                        Ing. cobrado
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Hs/mes</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">
                        Costo prof.
                      </th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Margen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {groupMetrics.map((g) => (
                      <tr key={g.groupId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {g.groupName}
                          {g.trainerCostNote && (
                            <span
                              className="ml-2 cursor-help text-yellow-500"
                              title={g.trainerCostNote}
                            >
                              ⚠
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {g.activeStudents}
                          {g.maxCapacity != null && (
                            <span className="text-gray-400"> / {g.maxCapacity}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {g.occupancyRate != null ? (
                            <span
                              className={
                                g.occupancyRate >= 0.8
                                  ? "font-semibold text-green-600"
                                  : g.occupancyRate >= 0.5
                                  ? "text-yellow-600"
                                  : "text-red-500"
                              }
                            >
                              {pct(g.occupancyRate)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {fmt(g.monthlyPrice)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {fmt(g.projectedRevenue)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">
                          {fmt(g.collectedRevenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {g.monthlyHours.toFixed(1)}h
                        </td>
                        <td className="px-4 py-3 text-right text-red-600">
                          {fmt(g.trainerCost)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            g.margin >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {fmt(g.margin)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-gray-700" colSpan={4}>
                        Total
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-700">
                        {fmt(groupMetrics.reduce((s, g) => s + g.projectedRevenue, 0))}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {fmt(groupMetrics.reduce((s, g) => s + g.collectedRevenue, 0))}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">—</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">
                        {fmt(groupMetrics.reduce((s, g) => s + g.trainerCost, 0))}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-bold ${
                          groupMetrics.reduce((s, g) => s + g.margin, 0) >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {fmt(groupMetrics.reduce((s, g) => s + g.margin, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
