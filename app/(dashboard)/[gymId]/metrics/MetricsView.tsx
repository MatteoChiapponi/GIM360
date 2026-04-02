"use client"

import { useState, useEffect, useCallback } from "react"
import { SkeletonMetrics } from "@/components/ui/Skeleton"
import { InfoTooltip } from "@/components/ui/InfoTooltip"

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

type HealthIndexMetrics = {
  score: number
  label: "Saludable" | "En desarrollo" | "Con problemas" | "Crítico"
  dim1Rentabilidad: { score: number; maxScore: number; groupsAboveMargin: number; totalGroups: number }
  dim2Ocupacion: {
    score: number; maxScore: number; occupancyRate: number | null
    totalStudents: number; totalCapacity: number; hasGroupsWithoutCapacity: boolean
  }
  dim3Eficiencia: { score: number; maxScore: number; costRatio: number }
  dim4Ganancias: { score: number; maxScore: number; ebitdaMargin: number }
}

type MetricView = "optimizacion" | "gimnasio" | "grupos"

const VIEWS: { id: MetricView; label: string }[] = [
  // { id: "optimizacion", label: "Optimización" }, // oculto temporalmente
  { id: "gimnasio", label: "Gimnasio" },
  { id: "grupos", label: "Grupos" },
]

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n)
}

function pct(n: number) { return `${Math.round(n * 100)}%` }

// ─── Metric Card ─────────────────────────────────────────────────────────────

function MiniBar({ percentage, color }: { percentage: number; color: string }) {
  const clamped = Math.min(Math.max(Math.round(percentage), 0), 100)
  return (
    <div className="mt-3">
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#F0EFEB]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${clamped}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function MetricCard({ label, value, context, percentage, barColor, size = "normal", tooltip, showBar = true, showPercentage = true }: {
  label: string; value: string; context: string; percentage: number; barColor: string
  size?: "normal" | "hero"; tooltip?: string; showBar?: boolean; showPercentage?: boolean
}) {
  const displayPct = Math.round(percentage)
  return (
    <div className={`rounded-xl border border-[#E5E4E0] bg-white overflow-hidden flex flex-col ${size === "hero" ? "px-6 py-5" : "px-5 py-4"}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D] flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </p>
      <div className="flex items-baseline gap-3 mt-1.5">
        <p className={`font-bold font-mono ${size === "hero" ? "text-3xl" : "text-2xl"}`} style={{ color: barColor }}>
          {value}
        </p>
        {showPercentage && (
          <span className={`font-bold font-mono ${size === "hero" ? "text-xl" : "text-lg"} opacity-80`} style={{ color: barColor }}>
            {displayPct}%
          </span>
        )}
      </div>
      {showBar && <MiniBar percentage={percentage} color={barColor} />}
      <p className="mt-1.5 text-xs text-[#68685F]">{context}</p>
    </div>
  )
}

// ─── Stacked Bar ─────────────────────────────────────────────────────────────

function StackedBar({ segments }: { segments: { label: string; value: string; pct: number; color: string }[] }) {
  return (
    <div className="rounded-xl border border-[#E5E4E0] bg-white px-4 py-4 sm:px-5 space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#F0EFEB]">
        {segments.map((s, i) => (
          <div key={i} className="h-full transition-all duration-500" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <div className="flex flex-col gap-1.5 sm:flex-row sm:justify-between text-xs">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-[#68685F]">{s.label}</span>
            <span className="font-mono font-semibold text-[#111110]">{s.value}</span>
            <span className="text-[#A5A49D]">({Math.round(s.pct)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Health Index View ────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return "#10b981"
  if (score >= 60) return "#f59e0b"
  if (score >= 40) return "#f97316"
  return "#ef4444"
}

function labelDescription(label: HealthIndexMetrics["label"]): string {
  switch (label) {
    case "Saludable": return "El gimnasio opera con buena rentabilidad, alta ocupación y costos controlados."
    case "En desarrollo": return "Hay margen de mejora en rentabilidad u ocupación. El gimnasio es viable pero puede optimizarse."
    case "Con problemas": return "Algunas dimensiones presentan debilidades que afectan la salud financiera."
    case "Crítico": return "El gimnasio tiene problemas financieros significativos que requieren atención urgente."
  }
}

function DimCard({ name, score, maxScore, metric, tooltip }: {
  name: string; score: number; maxScore: number; metric: string; tooltip: string
}) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0
  const color = scoreColor(Math.round((score / maxScore) * 100))
  return (
    <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-4 flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D] flex items-center gap-1">
        {name}
        <InfoTooltip text={tooltip} />
      </p>
      <p className="font-bold font-mono text-2xl" style={{ color }}>
        {score}<span className="text-base font-normal text-[#A5A49D]"> / {maxScore}</span>
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#F0EFEB]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(Math.round(pct), 100)}%`, backgroundColor: color }} />
      </div>
      <p className="text-xs text-[#68685F]">{metric}</p>
    </div>
  )
}

function OccupancyCard({ occ }: { occ: HealthIndexMetrics["dim2Ocupacion"] }) {
  const occPct = occ.occupancyRate != null ? Math.round(occ.occupancyRate * 100) : null
  const color = occPct != null ? (occPct >= 80 ? "#10b981" : occPct >= 50 ? "#f59e0b" : "#ef4444") : "#A5A49D"
  return (
    <div className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Ocupación general de grupos</p>
      <div className="flex items-baseline gap-3">
        {occPct != null ? (
          <>
            <span className="text-3xl font-bold font-mono" style={{ color }}>{occPct}%</span>
            <span className="text-sm text-[#68685F]">{occ.totalStudents} de {occ.totalCapacity} lugares ocupados</span>
          </>
        ) : (
          <span className="text-sm text-[#A5A49D]">Sin capacidad máxima configurada en los grupos</span>
        )}
      </div>
      {occPct != null && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#F0EFEB]">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(occPct, 100)}%`, backgroundColor: color }} />
        </div>
      )}
      {occ.hasGroupsWithoutCapacity && (
        <p className="text-xs text-[#A5A49D]">Algunos grupos no tienen capacidad máxima configurada y no se incluyen en este cálculo.</p>
      )}
    </div>
  )
}

function HealthIndexView({ health: h }: { health: HealthIndexMetrics }) {
  const color = scoreColor(h.score)
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-[#111110]">Nivel de optimización del gimnasio</h2>

      {/* Hero score */}
      <div className="rounded-xl border border-[#E5E4E0] bg-white px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-bold font-mono" style={{ color }}>{h.score}</span>
          <span className="text-2xl text-[#A5A49D] font-mono">/ 100</span>
          <InfoTooltip text={`¿Qué es este puntaje?\n\nMide la salud financiera del gimnasio en un número del 0 al 100, combinando cuatro aspectos clave: qué tan rentables son los grupos, qué tan llenos están, qué parte de los ingresos se va en costos, y cuánto queda de ganancia neta.\n\n¿Cómo se calcula?\nCada aspecto aporta puntos según su rendimiento:\n• Rentabilidad — hasta 35 pts\n• Ocupación — hasta 35 pts\n• Ganancias — hasta 20 pts\n• Eficiencia de costos — hasta 10 pts\n\nNiveles:\n80–100 → Saludable\n60–79 → En desarrollo\n40–59 → Con problemas\n0–39 → Crítico`} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="inline-block rounded-full px-3 py-0.5 text-xs font-semibold text-white w-fit" style={{ backgroundColor: color }}>
            {h.label}
          </span>
          <p className="text-sm text-[#68685F] max-w-sm">{labelDescription(h.label)}</p>
        </div>
      </div>

      {/* 4 dimension cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DimCard
          name="Rentabilidad"
          score={h.dim1Rentabilidad.score}
          maxScore={h.dim1Rentabilidad.maxScore}
          metric={`Grupos con margen > 50%: ${h.dim1Rentabilidad.groupsAboveMargin} de ${h.dim1Rentabilidad.totalGroups}`}
          tooltip={`¿Cuántos grupos generan un margen mayor al 50% después de pagar a los profesores?\n\nCada grupo que supera el 50% de margen suma 5 puntos. Los grupos por debajo no suman.\n\nPuntaje (máx. ${h.dim1Rentabilidad.maxScore}):\n5 pts por cada grupo con margen > 50%\n\nNiveles del puntaje total:\n80–100 → Saludable\n60–79 → En desarrollo\n40–59 → Con problemas\n0–39 → Crítico`}
        />
        <DimCard
          name="Ocupación"
          score={h.dim2Ocupacion.score}
          maxScore={h.dim2Ocupacion.maxScore}
          metric={
            h.dim2Ocupacion.occupancyRate !== null
              ? `Ocupación: ${Math.round(h.dim2Ocupacion.occupancyRate * 100)}% (${h.dim2Ocupacion.totalStudents} / ${h.dim2Ocupacion.totalCapacity} lugares)${h.dim2Ocupacion.hasGroupsWithoutCapacity ? " — algunos grupos sin capacidad" : ""}`
              : "Sin grupos con capacidad máxima configurada"
          }
          tooltip={`¿Qué tan llenos están los grupos del gimnasio?\n\nCompara la cantidad de alumnos activos con la capacidad máxima de cada grupo.\n\nPuntaje (máx. 35):\n≥ 90% de ocupación → 35 pts\n75–90% → 25 pts\n60–75% → 15 pts\n50–60% → 5 pts\n< 50% → 0 pts\n\nNiveles del puntaje total:\n80–100 → Saludable\n60–79 → En desarrollo\n40–59 → Con problemas\n0–39 → Crítico${h.dim2Ocupacion.hasGroupsWithoutCapacity ? "\n\nNota: los grupos sin capacidad máxima configurada no se incluyen en este cálculo." : ""}`}
        />
        <DimCard
          name="Eficiencia de costos"
          score={h.dim3Eficiencia.score}
          maxScore={h.dim3Eficiencia.maxScore}
          metric={`Ratio de costos: ${Math.round(h.dim3Eficiencia.costRatio * 100)}% de lo cobrado`}
          tooltip={`¿Qué parte de lo cobrado se va en gastos?\n\nSuma el costo de profesores más los gastos fijos y lo compara con el total cobrado.\n\nPuntaje (máx. 10):\n< 50% en costos → 10 pts\n50–60% → 7 pts\n60–70% → 3 pts\n≥ 70% → 0 pts\n\nNiveles del puntaje total:\n80–100 → Saludable\n60–79 → En desarrollo\n40–59 → Con problemas\n0–39 → Crítico`}
        />
        <DimCard
          name="Ganancias"
          score={h.dim4Ganancias.score}
          maxScore={h.dim4Ganancias.maxScore}
          metric={`Margen de ganancia: ${Math.round(h.dim4Ganancias.ebitdaMargin * 100)}%`}
          tooltip={`¿Qué queda realmente en el gimnasio al final del mes?\n\nEs la ganancia neta: lo cobrado menos los profesores y todos los gastos fijos.\n\nPuntaje (máx. 20):\n> 50% de ganancia → 20 pts\n40–50% → 15 pts\n30–40% → 10 pts\n20–30% → 5 pts\n< 20% → 0 pts\n\nNiveles del puntaje total:\n80–100 → Saludable\n60–79 → En desarrollo\n40–59 → Con problemas\n0–39 → Crítico`}
        />
      </div>
    </div>
  )
}

// ─── Group Detail View ────────────────────────────────────────────────────────

function GroupDetailView({ group: g, onBack }: { group: GroupMetrics; onBack: () => void }) {
  const collectionPct = g.projectedRevenue > 0 ? (g.collectedRevenue / g.projectedRevenue) * 100 : 0
  const uncollected = g.projectedRevenue - g.collectedRevenue
  const uncollectedPct = 100 - collectionPct
  const costRevenuePct = g.collectedRevenue > 0 ? (g.trainerCost / g.collectedRevenue) * 100 : 0
  const marginPct = g.collectedRevenue > 0 ? (g.margin / g.collectedRevenue) * 100 : 0
  const marginColor = g.margin >= 0 ? "#10b981" : "#ef4444"
  const occupancyPct = g.occupancyRate != null ? g.occupancyRate * 100 : null
  const occupancyColor = occupancyPct != null ? (occupancyPct >= 80 ? "#10b981" : occupancyPct >= 50 ? "#f59e0b" : "#ef4444") : "#A5A49D"
  const spotsRemaining = g.maxCapacity != null ? g.maxCapacity - g.activeStudents : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={onBack}
          className="cursor-pointer flex items-center gap-1.5 text-sm text-[#A5A49D] hover:text-[#111110] transition-colors mb-1"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2 4 8l6 6" />
          </svg>
          Volver a grupos
        </button>
        <h2 className="text-xl font-semibold text-[#111110]">{g.groupName}</h2>
      </div>

      {/* Section A — Hero: Margen del grupo */}
      <MetricCard
        size="hero"
        label="Margen del grupo"
        value={fmt(g.margin)}
        percentage={marginPct}
        barColor={marginColor}
        showBar={false}
        context={g.margin >= 0 ? "margen sobre lo cobrado" : "pérdida sobre lo cobrado"}
        tooltip={`Ingreso cobrado menos costo de profesores.\nNo incluye gastos fijos del gimnasio.\n\nCálculo:\n${fmt(g.collectedRevenue)} (cobrado)\n− ${fmt(g.trainerCost)} (profesores)\n= ${fmt(g.margin)}`}
      />

      {/* Section B — Ingresos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard
          label="Cobrado"
          value={fmt(g.collectedRevenue)}
          percentage={collectionPct}
          barColor="#10b981"
          context={`${Math.round(collectionPct)}% del ingreso proyectado (${fmt(g.projectedRevenue)})`}
        />
        <MetricCard
          label="Pendiente"
          value={fmt(uncollected)}
          percentage={uncollectedPct}
          barColor="#f59e0b"
          context={`${Math.round(uncollectedPct)}% del ingreso proyectado sin cobrar`}
        />
      </div>

      {/* Section C — Desglose de ingresos */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D] mb-2">Desglose de ingresos</p>
        <StackedBar segments={[
          { label: "Cobrado", value: fmt(g.collectedRevenue), pct: collectionPct, color: "#10b981" },
          { label: "Pendiente", value: fmt(uncollected), pct: uncollectedPct, color: "#f59e0b" },
        ]} />
      </div>

      {/* Section D — Costos y equilibrio */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard
          label="Costo profesores"
          value={fmt(g.trainerCost)}
          percentage={costRevenuePct}
          barColor="#ef4444"
          context={`${Math.round(costRevenuePct)}% de lo cobrado se destina a profesores`}
          tooltip={`Tarifa/hora × horas semanales × 4,33 semanas/mes.\n\nHoras/mes del grupo: ${g.monthlyHours.toFixed(1)}h\n\nCálculo:\n${fmt(g.trainerCost)} profesores / ${fmt(g.collectedRevenue)} cobrado = ${Math.round(costRevenuePct)}%`}
        />
        <MetricCard
          label="Punto de equilibrio"
          value={g.breakevenStudents != null ? `${g.breakevenStudents} alumnos` : "—"}
          percentage={
            g.breakevenStudents != null && g.activeStudents > 0
              ? Math.min((g.activeStudents / g.breakevenStudents) * 100, 100)
              : 0
          }
          barColor={marginColor}
          context={
            g.margin >= 0
              ? `Superado — ${g.activeStudents} alumnos activos cubren los costos`
              : `Faltan ${(g.breakevenStudents ?? 0) - g.activeStudents} alumnos para cubrir costos`
          }
          tooltip={`Mínimo de alumnos necesarios para cubrir el costo de profesores.\n\nCálculo:\n${fmt(g.trainerCost)} costo / ${fmt(g.monthlyPrice)} precio = ${g.breakevenStudents} alumnos`}
        />
      </div>

      {/* Section E — Estructura de costos */}
      {g.collectedRevenue > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D] mb-2">Estructura de costos sobre lo cobrado</p>
          <StackedBar segments={
            g.margin >= 0
              ? [
                  { label: "Profesores", value: fmt(g.trainerCost), pct: costRevenuePct, color: "#ef4444" },
                  { label: "Margen", value: fmt(g.margin), pct: marginPct, color: "#10b981" },
                ]
              : [
                  { label: "Profesores", value: fmt(g.trainerCost), pct: 100, color: "#ef4444" },
                ]
          } />
        </div>
      )}

      {/* Section F — Ocupación e info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard
          label="Ocupación"
          value={g.maxCapacity != null ? `${g.activeStudents} / ${g.maxCapacity}` : `${g.activeStudents}`}
          percentage={occupancyPct ?? 0}
          barColor={occupancyColor}
          showBar={g.maxCapacity != null}
          context={
            g.maxCapacity != null
              ? (spotsRemaining! > 0 ? `${spotsRemaining} lugares disponibles` : "Grupo completo")
              : "Sin capacidad máxima configurada"
          }
          tooltip={
            g.maxCapacity != null
              ? `Porcentaje de alumnos activos respecto a la capacidad máxima.\n\nCálculo:\n${g.activeStudents} alumnos / ${g.maxCapacity} capacidad = ${Math.round(occupancyPct!)}%`
              : `${g.activeStudents} alumnos activos en el grupo.`
          }
        />
        <MetricCard
          label="Precio mensual"
          value={fmt(g.monthlyPrice)}
          percentage={0}
          barColor="#111110"
          showPercentage={false}
          showBar={false}
          context="Por alumno inscripto"
        />
      </div>

      {/* Section G — Info adicional */}
      <div className="rounded-xl border border-[#E5E4E0] bg-[#FAFAF9] px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D] mb-3">Información adicional</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-[#A5A49D] text-xs">Horas/mes</p>
            <p className="font-mono font-semibold text-[#111110]">{g.monthlyHours.toFixed(1)}h</p>
          </div>
          <div>
            <p className="text-[#A5A49D] text-xs">Precio/mes</p>
            <p className="font-mono font-semibold text-[#111110]">{fmt(g.monthlyPrice)}</p>
          </div>
          <div>
            <p className="text-[#A5A49D] text-xs">Ing. proyectado</p>
            <p className="font-mono font-semibold text-[#111110]">{fmt(g.projectedRevenue)}</p>
          </div>
          <div>
            <p className="text-[#A5A49D] text-xs">Alumnos activos</p>
            <p className="font-mono font-semibold text-[#111110]">{g.activeStudents}</p>
          </div>
        </div>
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

function toYearMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function MetricsView({ gymId }: { gymId: string }) {
  const period = toYearMonth(new Date())
  const [activeView, setActiveView] = useState<MetricView>("gimnasio")
  const [healthMetrics, setHealthMetrics] = useState<HealthIndexMetrics | null>(null)
  const [gymMetrics, setGymMetrics] = useState<GymMetrics | null>(null)
  const [groupMetrics, setGroupMetrics] = useState<GroupMetrics[]>([])
  const [selectedGroup, setSelectedGroup] = useState<GroupMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ gymId, period })
      const [gymRes, groupsRes, healthRes] = await Promise.all([
        fetch(`/api/metrics/gym?${params}`, { signal }),
        fetch(`/api/metrics/groups?${params}`, { signal }),
        fetch(`/api/metrics/health?${params}`, { signal }),
      ])
      if (!gymRes.ok || !groupsRes.ok || !healthRes.ok) { setError("No se pudieron cargar las métricas."); return }
      const [gym, groups, health] = await Promise.all([gymRes.json(), groupsRes.json(), healthRes.json()])
      setGymMetrics(gym); setGroupMetrics(groups); setHealthMetrics(health)
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      setError("Error de conexión. Intentá de nuevo.")
    }
    finally { setLoading(false) }
  }, [gymId, period])

  useEffect(() => {
    const controller = new AbortController()
    fetchMetrics(controller.signal)
    return () => controller.abort()
  }, [fetchMetrics])

  const totalRevenue = gymMetrics ? gymMetrics.totalCollectedRevenue + gymMetrics.totalPendingRevenue : 0
  const totalCosts = gymMetrics ? gymMetrics.totalTrainerCost + gymMetrics.totalFixedExpenses : 0
  const collectedPct = totalRevenue > 0 ? (gymMetrics?.totalCollectedRevenue ?? 0) / totalRevenue * 100 : 0
  const pendingPct = totalRevenue > 0 ? (gymMetrics?.totalPendingRevenue ?? 0) / totalRevenue * 100 : 0
  const trainerCostPct = gymMetrics && gymMetrics.totalCollectedRevenue > 0 ? gymMetrics.totalTrainerCost / gymMetrics.totalCollectedRevenue * 100 : 0
  const fixedExpPct = gymMetrics && gymMetrics.totalCollectedRevenue > 0 ? gymMetrics.totalFixedExpenses / gymMetrics.totalCollectedRevenue * 100 : 0
  const totalCostPct = gymMetrics && gymMetrics.totalCollectedRevenue > 0 ? totalCosts / gymMetrics.totalCollectedRevenue * 100 : 0
  const ebitdaPct = gymMetrics && gymMetrics.totalCollectedRevenue > 0 ? (gymMetrics.ebitda / gymMetrics.totalCollectedRevenue) * 100 : 0
  const ebitdaColor = gymMetrics && gymMetrics.ebitda >= 0 ? "#10b981" : "#ef4444"
  const totalGroupMargin = groupMetrics.reduce((s, g) => s + g.margin, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-semibold text-[#111110]">Métricas</h1>
          <span className="text-xl text-[#C8C7C3]">/</span>
          <span className="text-xl font-semibold capitalize text-[#68685F]">{formatPeriod(period)}</span>
        </div>
        <p className="mt-0.5 text-sm text-[#A5A49D]">Rentabilidad y costos del gimnasio</p>
      </div>

      {/* View selector */}
      <div className="flex items-center gap-1 border-b border-[#E5E4E0]">
        {VIEWS.map(({ id, label }) => (
          <button key={id} onClick={() => { setActiveView(id); setSelectedGroup(null) }}
            className={`cursor-pointer px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeView === id ? "border-[#111110] text-[#111110]" : "border-transparent text-[#A5A49D] hover:text-[#68685F]"
            }`}
          >{label}</button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <SkeletonMetrics />
      ) : gymMetrics ? (
        <>
          {/* ── OPTIMIZACIÓN ── */}
          {activeView === "optimizacion" && healthMetrics && (
            <HealthIndexView health={healthMetrics} />
          )}

          {/* ── GIMNASIO ── */}
          {activeView === "gimnasio" && (
            <div className="space-y-5">
              {/* Puntaje de optimización */}
              {healthMetrics && (
                <div className="rounded-xl border border-[#E5E4E0] bg-white px-6 py-5 space-y-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Optimización del gimnasio</p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-baseline gap-3">
                      <span className="text-5xl font-bold font-mono" style={{ color: scoreColor(healthMetrics.score) }}>{healthMetrics.score}</span>
                      <span className="text-2xl text-[#A5A49D] font-mono">/ 100</span>
                      <InfoTooltip text={`Puntaje de salud financiera del gimnasio (0–100).\n\nMétricas consideradas:\n• Rentabilidad de grupos\n• Ocupación\n• Ganancias netas\n• Eficiencia de costos`} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="inline-block rounded-full px-3 py-0.5 text-xs font-semibold text-white w-fit" style={{ backgroundColor: scoreColor(healthMetrics.score) }}>
                        {healthMetrics.label}
                      </span>
                      <p className="text-sm text-[#68685F] max-w-sm">{labelDescription(healthMetrics.label)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Hero: Ganancia del mes */}
              <MetricCard
                size="hero"
                label="Ganancia del mes"
                value={fmt(gymMetrics.ebitda)}
                percentage={ebitdaPct}
                barColor={ebitdaColor}
                showBar={false}
                context={gymMetrics.ebitda >= 0 ? "margen sobre lo cobrado" : "pérdida sobre lo cobrado"}
                tooltip={`Lo que queda después de pagar profesores y gastos fijos.\n\nCálculo:\n${fmt(gymMetrics.totalCollectedRevenue)} (cobrado)\n− ${fmt(gymMetrics.totalTrainerCost)} (profesores)\n− ${fmt(gymMetrics.totalFixedExpenses)} (gastos fijos)\n= ${fmt(gymMetrics.ebitda)}`}
              />

              {/* Ingresos: Cobrado + Pendiente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MetricCard
                  label="Cobrado"
                  value={fmt(gymMetrics.totalCollectedRevenue)}
                  percentage={collectedPct}
                  barColor="#10b981"
                  context={`${Math.round(collectedPct)}% del total esperado (${fmt(totalRevenue)})`}
                  tooltip={`Suma de todas las cuotas pagadas en este período.\n\nCálculo:\n${fmt(gymMetrics.totalCollectedRevenue)} cobrado / ${fmt(totalRevenue)} total = ${Math.round(collectedPct)}%`}
                />
                <MetricCard
                  label="Pendiente de cobro"
                  value={fmt(gymMetrics.totalPendingRevenue)}
                  percentage={pendingPct}
                  barColor="#f59e0b"
                  context={`${Math.round(pendingPct)}% del total esperado sin cobrar`}
                  tooltip={`Cuotas pendientes y vencidas que aún no fueron cobradas.\n\nCálculo:\n${fmt(gymMetrics.totalPendingRevenue)} pendiente / ${fmt(totalRevenue)} total = ${Math.round(pendingPct)}%`}
                />
              </div>

              {/* Costos del mes */}
              <div className="rounded-xl border border-[#E5E4E0] bg-[#FAFAF9] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]">Costos del mes</p>
                  <p className="text-sm font-semibold font-mono text-red-700">{fmt(totalCosts)}<span className="ml-1.5 text-xs font-normal text-[#A5A49D]">({Math.round(totalCostPct)}% de lo cobrado)</span></p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <MetricCard
                    label="Profesores"
                    value={fmt(gymMetrics.totalTrainerCost)}
                    percentage={trainerCostPct}
                    barColor="#ef4444"
                    context={`${Math.round(trainerCostPct)}% de lo cobrado se destina a profesores`}
                    tooltip={`Costo total de profesores: tarifa/hora × horas semanales × 4,33 semanas/mes.\n\nCálculo:\n${fmt(gymMetrics.totalTrainerCost)} profesores / ${fmt(gymMetrics.totalCollectedRevenue)} cobrado = ${Math.round(trainerCostPct)}%`}
                  />
                  <MetricCard
                    label="Gastos fijos"
                    value={fmt(gymMetrics.totalFixedExpenses)}
                    percentage={fixedExpPct}
                    barColor="#ef4444"
                    context={`${Math.round(fixedExpPct)}% de lo cobrado se va en gastos fijos`}
                    tooltip={`Alquiler, servicios, seguros y otros gastos fijos configurados.\n\nCálculo:\n${fmt(gymMetrics.totalFixedExpenses)} gastos fijos / ${fmt(gymMetrics.totalCollectedRevenue)} cobrado = ${Math.round(fixedExpPct)}%`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── GRUPOS ── */}
          {activeView === "grupos" && (
            <div className="space-y-5">
              {selectedGroup ? (
                <GroupDetailView group={selectedGroup} onBack={() => setSelectedGroup(null)} />
              ) : (
                <>
                  {/* Ocupación general */}
                  {healthMetrics && (
                    <OccupancyCard occ={healthMetrics.dim2Ocupacion} />
                  )}

                  {groupMetrics.length === 0 ? (
                    <p className="text-sm text-[#A5A49D]">No hay grupos en este gimnasio.</p>
                  ) : (
                <div className="overflow-x-auto rounded-xl border border-[#E5E4E0] bg-white">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-[#F0EFEB]">
                        {[
                          { label: "Grupo", align: "left", tooltip: null },
                          { label: "Alumnos", align: "right", tooltip: "Alumnos activos en el grupo. Si hay capacidad máxima configurada, se muestra el total." },
                          { label: "Ocupación", align: "right", tooltip: "Porcentaje de ocupación respecto a la capacidad máxima del grupo." },
                          { label: "Ing. proyectado", align: "right", tooltip: "Ingreso esperado si todos los alumnos activos pagaran: alumnos × precio/mes." },
                          { label: "Ing. cobrado", align: "right", tooltip: "Suma real de pagos PAGADOS en el período para este grupo." },
                          { label: "Costo prof.", align: "right", tooltip: "Costo total de los profesores: tarifa/hora × horas semanales × 4,33 semanas/mes." },
                          { label: "Punto equilibrio", align: "right", tooltip: "Mínimo de alumnos que deben pagar para cubrir el costo de los profesores." },
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
                        <tr
                          key={g.groupId}
                          className={`cursor-pointer hover:bg-[#FAFAF9] transition-colors ${i > 0 ? "border-t border-[#F7F6F3]" : ""}`}
                          onClick={() => setSelectedGroup(g)}
                        >
                          <td className="px-4 py-4 font-medium text-[#111110]">{g.groupName}</td>
                          <td className="px-4 py-4 text-right text-[#68685F]">
                            {g.activeStudents}{g.maxCapacity != null && <span className="text-[#A5A49D]"> / {g.maxCapacity}</span>}
                          </td>
                          <td className="px-4 py-4 text-right">
                            {g.occupancyRate != null ? (
                              <span className={`font-mono font-medium ${g.occupancyRate >= 0.8 ? "text-emerald-700" : g.occupancyRate >= 0.5 ? "text-amber-700" : "text-red-700"}`}>{pct(g.occupancyRate)}</span>
                            ) : <span className="text-[#A5A49D]">—</span>}
                          </td>
                          <td className="px-4 py-4 text-right font-mono text-[#68685F]">{fmt(g.projectedRevenue)}</td>
                          <td className="px-4 py-4 text-right font-mono font-semibold text-[#111110]">{fmt(g.collectedRevenue)}</td>
                          <td className="px-4 py-4 text-right font-mono text-[#68685F]">{fmt(g.trainerCost)}</td>
                          <td className="px-4 py-4 text-right">
                            {g.breakevenStudents === null ? (
                              <span className="text-[#A5A49D]">—</span>
                            ) : (
                              <span className="font-mono font-medium text-[#68685F]">
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
                        <td className="px-4 py-3.5 font-semibold text-[#68685F]" colSpan={3}>Total</td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#68685F]">{fmt(groupMetrics.reduce((s, g) => s + g.projectedRevenue, 0))}</td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#111110]">{fmt(groupMetrics.reduce((s, g) => s + g.collectedRevenue, 0))}</td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#68685F]">{fmt(groupMetrics.reduce((s, g) => s + g.trainerCost, 0))}</td>
                        <td className="px-4 py-3.5 text-right text-[#A5A49D]">—</td>
                        <td className={`px-4 py-3.5 text-right font-mono font-bold ${totalGroupMargin >= 0 ? "text-emerald-700" : "text-red-700"}`}>{fmt(totalGroupMargin)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
