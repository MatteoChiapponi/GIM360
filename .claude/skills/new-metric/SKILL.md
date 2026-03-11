---
name: new-metric
description: Create a new GYM360 metrics endpoint — analytical service + route handler. Use this for any new KPI, financial report, or aggregation that doesn't map to standard CRUD.
argument-hint: <scope> (e.g. trainers, students, retention, attendance)
allowed-tools: Read, Write, Bash, Glob, Grep
---

# Create new metric for: $ARGUMENTS

## Step 1 — Read context

Read these files before writing anything:
- `CLAUDE.md`
- `prisma/schema.prisma` — understand available models and fields
- `modules/metrics/metrics.schema.ts` — shared `MetricsQueryInput`
- `modules/metrics/groups/groups-metrics.service.ts` — reference service (proportional revenue, monthly hours)
- `modules/metrics/gym/gym-metrics.service.ts` — reference service (aggregate pattern, EBITDA)
- `app/api/metrics/groups/route.ts` — reference route handler

## Step 2 — Design phase (think before coding)

Answer these before writing code:

1. **Scope**: what entity or cross-section? (`$ARGUMENTS` — groups, trainers, students, gym-wide, attendance...)
2. **Time period**: does this need `period: "YYYY-MM"`? (financial metrics yes, structural metrics maybe not)
3. **Output type**: define the TypeScript `export type` first. What exact fields does the frontend need?
4. **Queries**: list the Prisma models to query. Which can use `aggregate` instead of `findMany`?
5. **Joins/distribution**: any multi-step computation (proportional splits, rate calculations, comparisons across periods)?
6. **Notes fields**: schema limitations that require a warning field in the output?

## Step 3 — Create the service

Output: `modules/metrics/$ARGUMENTS/$ARGUMENTS-metrics.service.ts`

### Required structure:

```ts
import { db } from "@/lib/db"
import type { MetricsQueryInput } from "../metrics.schema"

// ── Time helpers (copy these verbatim, do not inline) ─────────────────────────
function parsePeriod(period: string): Date {
  const [year, month] = period.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}
function parseMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}
function computeMonthlyHours(
  schedules: { weekDays: string[]; startTime: string; endTime: string }[]
): number {
  return schedules.reduce((total, s) => {
    const durationHrs = (parseMinutes(s.endTime) - parseMinutes(s.startTime)) / 60
    return total + durationHrs * s.weekDays.length * 4.33
  }, 0)
}
// (only include helpers that are actually used)

// ── Return type (define BEFORE the function) ──────────────────────────────────
export type XxxMetrics = {
  // field: type  ← one field per line with a JSDoc comment explaining the formula
}

// ── Service function ──────────────────────────────────────────────────────────
export async function getXxxMetrics(input: MetricsQueryInput): Promise<XxxMetrics> {
  // 1. Parse period if needed
  const periodDate = parsePeriod(input.period)

  // 2. Parallel queries — NEVER await sequentially
  const [queryA, queryB] = await Promise.all([...])

  // 3. JS computation
  // Always: Number(decimalField) — Prisma returns Decimal objects
  // Always: ?? 0 when aggregate _sum can be null

  // 4. Return typed object
  return { ... }
}
```

### Rules for the service:
- **No auth, no belongs checks** — pure data access
- **`Number()` on every Decimal field** — `monthlyPrice`, `amount`, `hourlyRate`, `fixedExpense.amount`
- **`Promise.all` for all independent queries**
- **DB-level `aggregate`** for simple sums over large tables (payments especially)
- **`findMany` + JS computation** when you need cross-entity joins or proportional splits
- **JSDoc on the exported type fields** explaining what each computed value means

### When to use `aggregate` vs `findMany`:

| Use `aggregate` | Use `findMany` |
|---|---|
| Simple sum/count/avg of a single model | Need to cross-join or distribute across entities |
| No per-row computation needed | Need to filter/transform per row in JS |
| Large dataset (many payments) | Small-medium dataset |

Example — aggregate:
```ts
db.payment.aggregate({
  where: { gymId: input.gymId, period: periodDate, status: "PAID" },
  _sum: { amount: true },
})
// Then: Number(result._sum.amount ?? 0)
```

Example — findMany with proportional distribution:
```ts
// When one payment covers multiple groups, split it by monthlyPrice ratio:
const share = (Number(sg.group.monthlyPrice) / totalMonthlyPrice) * Number(payment.amount)
```

## Step 4 — Create the route handler

Output: `app/api/metrics/$ARGUMENTS/route.ts`

```ts
import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { metricsQuerySchema } from "@/modules/metrics/metrics.schema"
import { getXxxMetrics } from "@/modules/metrics/$ARGUMENTS/$ARGUMENTS-metrics.service"

export const GET = withAuth([UserRole.OWNER], async (req, session) => {
  const parsed = metricsQuerySchema.safeParse({
    gymId: req.nextUrl.searchParams.get("gymId"),
    period: req.nextUrl.searchParams.get("period"),
  })
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!await gymBelongsToOwner(parsed.data.gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await getXxxMetrics(parsed.data))
})
```

If `period` is not needed for this metric, extend `metricsQuerySchema` with `.omit({ period: true })` inline or create a local schema.

## Step 5 — Verify

```bash
npx tsc --noEmit
```

Fix ALL type errors before finishing. Common gotchas:
- Forgetting `Number()` on Decimal fields → type mismatch
- `_sum.amount` is `Decimal | null` → need `?? 0` before `Number()`
- `params` in `[id]` routes must be `await`-ed (not applicable to metrics, just a reminder)

## Report

List:
- Files created
- Endpoint: `GET /api/metrics/$ARGUMENTS?gymId=...&period=YYYY-MM`
- Output fields with brief description of what each calculates
