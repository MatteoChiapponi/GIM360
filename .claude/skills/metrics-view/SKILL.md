---
name: metrics-view
description: Reference for the GYM360 MetricsView frontend structure — tab system, period constraints, and how to add new metric sections. Use when adding a new metric endpoint that must also appear in the UI.
allowed-tools: Read, Write, Edit, Glob, Grep
---

# MetricsView — estructura de la vista

Archivo: `app/(dashboard)/[gymId]/metrics/MetricsView.tsx`

## Regla de período (CRÍTICO)

El input de mes **siempre debe tener `max={maxPeriod}`** para bloquear la selección de meses futuros.
Lo mismo aplica a `PaymentsView.tsx`.

```tsx
const maxPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
// ...
<input type="month" value={period} max={maxPeriod} onChange={...} />
```

## Sistema de tabs

Los tabs representan **secciones del backend** (un endpoint = un tab). Están definidos en el array `VIEWS`:

```ts
type MetricView = "optimizacion" | "gimnasio" | "grupos"  // extender al agregar secciones

const VIEWS: { id: MetricView; label: string }[] = [
  { id: "optimizacion", label: "Optimización" },  // índice de salud 0-100 — SIEMPRE el primero
  { id: "gimnasio",     label: "Gimnasio" },       // → /api/metrics/gym
  { id: "grupos",       label: "Grupos" },         // → /api/metrics/groups
  // agregar aquí al crear nuevos endpoints
]
```

El tab activo por defecto es `"optimizacion"`.

## Secciones actuales

| Tab | Endpoint | Datos que muestra |
|---|---|---|
| **Optimización** | `/api/metrics/health` | Índice de salud 0–100 con 4 dimensiones (ver abajo) |
| **Gimnasio** | `/api/metrics/gym` | 5 stat cards (cobrado, pendiente, entrenadores, fijos, EBITDA) + barra de progreso |
| **Grupos** | `/api/metrics/groups` | Tabla completa con ocupación, precios, ingresos, costos y margen por grupo |

## Índice de salud — reglas de scoring

Servicio: `modules/metrics/health/health-metrics.service.ts`
Tipo exportado: `HealthIndexMetrics`

### Dim 1 — Rentabilidad (max variable = grupos × 5)
- +5 pts por cada grupo con margen > 50% (ingresos − costo entrenadores) / ingresos
- Grupos sin ingresos ese mes no cuentan
- `maxScore = totalGroups * 5`

### Dim 2 — Ocupación (max 35)
- Se evalúa el grupo con **peor ocupación** (todos deben cumplir la condición)
- ≥ 90% → 35 pts
- 75–90% → 25 pts
- 60–75% → 15 pts
- 50–60% → 5 pts
- < 50% → 0 pts
- Grupos sin `maxCapacity` configurada se excluyen del cálculo

### Dim 3 — Eficiencia de costos (max 10)
- `costRatio = (costo entrenadores + gastos fijos) / cobrado`
- < 50% → 10 pts
- 50–60% → 7 pts
- 60–70% → 3 pts
- ≥ 70% → 0 pts

### Dim 4 — Ganancias / ingresos (max 20)
- `ebitdaMargin = (cobrado − entrenadores − gastos fijos) / cobrado`
- > 50% → 20 pts
- 40–50% → 15 pts
- 30–40% → 10 pts
- 20–30% → 5 pts
- < 20% → 0 pts

### Labels del score total
- 80–100 → Saludable
- 60–79 → En desarrollo
- 40–59 → Con problemas
- 0–39 → Crítico

## Cómo agregar una nueva sección (checklist)

1. **Backend**: crear el endpoint en `app/api/metrics/<nombre>/route.ts` y su servicio en `modules/metrics/<nombre>/`.
   Usar la skill `new-metric` para esto.

2. **Tipo en el frontend**: agregar el nuevo id al tipo `MetricView`:
   ```ts
   type MetricView = "general" | "gimnasio" | "grupos" | "<nombre>"
   ```

3. **Agregar al array VIEWS**:
   ```ts
   { id: "<nombre>", label: "Nombre visible" },
   ```

4. **Estado y fetch**: agregar el `useState` para los datos y extender `fetchMetrics` con un nuevo `fetch` dentro del `Promise.all`.

5. **Renderizar la sección**:
   ```tsx
   {activeView === "<nombre>" && (
     <div>...</div>
   )}
   ```

6. **Actualizar General**: agregar un resumen compacto de la nueva sección a la vista `"general"`.

## Componentes reutilizables disponibles en el archivo

- `StatCard` — tarjeta con valor destacado, sub-texto y acento de color lateral (positive/negative/neutral)
- `CollectionProgress` — barra de progreso de cobro (collected / total)

## Convenciones de diseño

- Números financieros: siempre `font-mono` (Geist Mono)
- Positivos: `text-emerald-700` / Negativos: `text-red-700`
- Headers de sección: `text-[10px] font-semibold uppercase tracking-[0.12em] text-[#A5A49D]`
- El tab activo: `border-b-2 border-[#111110] text-[#111110]`
- Sin sombras — solo bordes `border-[#E5E4E0]`
