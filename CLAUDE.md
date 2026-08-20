# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (http://localhost:3000)
npm run build     # Production build (also runs type check)
npm run lint      # ESLint
npm test          # Vitest (una pasada)
npm run test:watch
npx tsc --noEmit  # Type check only

# Prisma (always run after schema changes)
npx prisma generate          # Regenerate client into app/generated/prisma/
npx prisma migrate dev       # Apply schema changes to DB
npx prisma migrate deploy    # Apply in production
npx prisma studio            # GUI for the DB

# Seed
npx tsx scripts/seed.ts      # Insert test owner (admin@gym360.com / admin1234)
npx tsx scripts/seed-dev.ts  # Dev dataset: 2 gyms + recepcionista (recepcion@gym360.com / recepcion1234)
```

After any change to `prisma/schema.prisma`, run `prisma migrate dev` then `prisma generate` before building.

## Architecture

**GYM360** is a multi-tenant SaaS for managing artistic gymnastics gyms. Multiple gyms coexist in a single DB, isolated by `gymId` FK on every entity.

### Authorization — patrón "Belongs"

El control de acceso se hace con métodos explícitos en `modules/belongs/belongs.service.ts`. Cada método recibe dos IDs y retorna `Promise<boolean>`.

```ts
gymBelongsToOwner(gymId, userId)          // gym.owner.userId === userId
gymBelongsToReceptionist(gymId, userId)   // receptionist activo de ese gym
gymBelongsToUser(gymId, userId)           // cualquier rol: owner | trainer | receptionist activo
trainerBelongsToGym(trainerId, gymId)     // trainer.gymId === gymId
receptionistBelongsToGym(receptionistId, gymId)
studentBelongsToGym(studentId, gymId)     // student.gymId === gymId
groupBelongsToGym(groupId, gymId)         // group.gymId === gymId
scheduleBelongsToGroup(scheduleId, groupId)
trainerBelongsToGroup(trainerId, groupId)
studentBelongsToGroup(studentId, groupId)
```

En handlers que aceptan más de un rol (ej. `[OWNER, RECEPTIONIST]`), el belongs va con
`gymBelongsToUser` — el gate de rol ya lo hizo `withAuth`, así que no puede colarse un rol de más.

**Los servicios NO verifican pertenencia** — son acceso a datos puro. La verificación siempre va en el route handler, antes de llamar al servicio:

```ts
// Route Handler pattern con Belongs
const gymId = req.nextUrl.searchParams.get("gymId")
if (!await gymBelongsToOwner(gymId, session.user.id)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
const students = await getStudentsByGym(gymId)  // sin ownerId — ya fue autorizado
```

Para roles distintos de OWNER, la autorización usa el belongs correspondiente a ese rol:
```ts
if (session.user.role === "TRAINER") {
  const trainer = await db.trainer.findFirst({ where: { userId: session.user.id } })
  if (!trainer || !await trainerBelongsToGroup(trainer.id, groupId)) return 403
}
```

### Framework versions (non-obvious)
- **Next.js 16** — uses `proxy.ts` instead of `middleware.ts` for route protection (renamed convention)
- **Prisma 7** — requires a driver adapter; the generated client lives at `app/generated/prisma/` (not `node_modules`). Always import from `@/app/generated/prisma/client`
- **NextAuth v5 beta** — exports `{ handlers, auth, signIn, signOut }` from `lib/auth.ts`; JWT sessions, no DB adapter
- **DB**: Supabase PostgreSQL via connection pooler (port 5432). Direct connection (port 5432 pooler URL) required for PrismaPg adapter.

### Key files
| File | Role |
|---|---|
| `lib/auth.ts` | NextAuth config — authorize logic with bcrypt, JWT/session callbacks propagate `id` and `role` |
| `lib/db.ts` | Prisma singleton — uses `PrismaPg` adapter; `DATABASE_URL` must be set |
| `lib/utils.ts` | `cn()` helper (clsx + tailwind-merge) |
| `lib/money.ts` | `round2()` y `formatMoney()` — el redondeo de todo monto que se guarda, compartido por servicios y vistas |
| `lib/payment-methods.ts` | Parte client-safe de los medios de pago: valores, etiquetas y la fórmula del ajuste |
| `lib/late-fee.ts` | Parte client-safe de la mora: vencimiento, días de atraso y la fórmula del recargo |
| `proxy.ts` | Route guard — sin sesión → `/login`; con sesión, manda cada rol a su área |
| `lib/guards.ts` | `requireGymRole(gymId, roles)` — guard de rol para páginas de `/[gymId]` |
| `lib/with-auth.ts` | `withAuth(roles, handler)` / `withAuthParams` — auth + rol + logging del request |
| `prisma/schema.prisma` | All DB models and enums |
| `prisma.config.ts` | Loads `.env.local` (override) then `.env`; passes `DATABASE_URL` to Prisma CLI |
| `types/next-auth.d.ts` | Extends `Session` type to include `user.id` and `user.role` |
| `scripts/seed.ts` | Creates test Owner user — runs standalone with `npx tsx` |

### Data model
```
User (auth)
 ├── Owner 1:1
 │    └── Gym[]
 │         ├── Trainer[]       (optional User 1:1 — trainer may not have login)
 │         ├── Receptionist[]  (required User 1:1 — only exists to log in)
 │         ├── Student[]
 │         ├── Group[]
 │         │    ├── TrainerGroup[]  (junction, includes hourlyRate)
 │         │    │    └── TrainerGroupSchedule[]
 │         │    ├── StudentGroup[]  (junction, includes enrolledAt)
 │         │    ├── Schedule[]      (weekDays: DayOfWeek[], startTime/endTime: "HH:MM")
 │         │    └── Attendance[]
 │         ├── Payment[]  ── CashClosing[]
 │         ├── PaymentMethodConfig[]  (uno por PaymentMethod; sin fila = habilitado y sin ajuste)
 │         ├── LateFeeConfig 0:1        (recargo por mora; sin fila = regla apagada)
 │         ├── StudentFile[]
 │         └── FixedExpense[]
 ├── Trainer 1:1  (optional)
 └── Receptionist 1:1  (optional)
```

### Roles
| Rol | Perfil | Cómo se crea | Alcance |
|---|---|---|---|
| `ADMIN` | ninguno | manualmente en la DB | plataforma: `/admin`, `/api/admin/*` |
| `OWNER` | `Owner` 1:1 | `POST /api/admin/owners` | sus gimnasios, todo el área `/[gymId]` |
| `TRAINER` | `Trainer` 1:1 opcional | `POST /api/trainers/:id/user` | `/trainer` — sus grupos y asistencias |
| `RECEPTIONIST` | `Receptionist` 1:1 requerido | `POST /api/receptionists` | un gimnasio: alumnos, asistencias y cuotas |

**RECEPTIONIST** — pertenece a un solo gimnasio (`Receptionist.gymId`) y comparte las vistas de
`/[gymId]`, con la nav recortada a Alumnos / Asistencias / Cuotas (`RECEPTIONIST_SECTIONS` en
`components/layout/NavLinks.tsx`). Puede hacer CRUD de alumnos (incluidas fichas y apto médico),
inscribirlos en grupos, generar las cuotas del mes y registrar pagos, y cargar asistencias.
Quedan fuera: cierres de caja, gastos, métricas, grupos, entrenadores y la configuración del gimnasio. `active: false` corta el
acceso sin borrar el registro; `DELETE` borra el `User` y arrastra al `Receptionist` por cascade.

### Enums (in schema.prisma)
- `UserRole`: `ADMIN | OWNER | TRAINER | RECEPTIONIST`
- `GymStatus`: `ACTIVE | INACTIVE | SUSPENDED`
- `StudentStatus`: `ACTIVE | INACTIVE | TRIAL`
- `PaymentStatus`: `PENDING | PAID | EXPIRED`
- `PaymentMethod`: `CASH | TRANSFER | CARD`
- `PaymentAdjustmentType`: `NONE | SURCHARGE | DISCOUNT` — ajuste que cada gimnasio le configura a un medio de pago
- `LateFeeType`: `FIXED | PERCENT` — si el recargo por mora es un monto en pesos o un % de la cuota
- `StudentFileType`: `FICHA | APTO_MEDICO`
- `DayOfWeek`: `MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY | SUNDAY`

### Medios de pago

Los tres valores de `PaymentMethod` son fijos, pero cada gimnasio configura cómo los usa en
`PaymentMethodConfig` (`modules/payment-methods/`): si están habilitados y qué recargo o descuento
en % se aplica al cobrar con ellos.

Todo gimnasio tiene sus tres filas: las de los que ya existían las cargó la migración
`20260820120000_backfill_payment_method_configs` (habilitados y sin ajuste, idempotente y sin pisar
config existente), y las de los nuevos las crea `createGym` junto con el gimnasio.
`getPaymentMethodConfigs` igual completa con el default lo que no encuentre, como red por si algún
gimnasio entra por fuera del alta (un insert a mano, un restore).

- **Configuración**: `/[gymId]/settings`, solo owner. `GET /api/payment-methods` lo leen owner y
  recepcionista (el recepcionista necesita saber con qué medios puede cobrar); `PATCH` es del owner.
  Siempre tiene que quedar al menos un medio habilitado — se valida sobre el resultado del merge,
  no sobre lo que manda el body.
- **Dónde vive qué**: `modules/payment-methods/` tiene el acceso a datos y `payments.pricing.ts`
  resuelve qué montos guardar en un update de pago (el route handler solo traduce el resultado a
  HTTP). `lib/payment-methods.ts` es la parte client-safe — valores, etiquetas y la fórmula del
  ajuste — que importan tanto las vistas como el servicio, para que la vista previa y el cobro no
  puedan calcular distinto.
- **Cobro**: el ajuste lo calcula el backend en `PATCH /api/payments/:id`, nunca el cliente. Guarda
  `baseAmount` (la cuota), `methodAdjustment` (firmado) y deja en `amount` el monto realmente
  cobrado, que es el que suman cierres de caja y métricas. Cobrar con un medio deshabilitado da 400.
  Al despagar, `amount` vuelve a `baseAmount` y el ajuste se limpia.

**Dónde impacta que `amount` ahora traiga el ajuste** — `amount` sigue siendo "la plata que entró",
así que casi todo lo aguas abajo ya era correcto:

| Lugar | Efecto |
|---|---|
| `cash-closings.service.ts` | El desglose por medio suma el monto cobrado. Correcto sin cambios. |
| `gym-metrics` | `totalCollectedRevenue` (PAID) incluye el ajuste; `totalPendingRevenue` (PENDING/EXPIRED) es la cuota sin ajustar. EBITDA queda bien: un recargo es ingreso real y un descuento es ingreso resignado. |
| `groups-metrics` / `health-metrics` | Reparten `amount` entre los grupos del alumno a prorrata del `monthlyPrice`. Se mantiene así para que `Σ cobrado por grupo == cobrado del gimnasio`; si se repartiera `baseAmount`, el ajuste desaparecería de la vista por grupo. |
| `MetricsView` (detalle de grupo) | Con recargo, lo cobrado puede superar a `projectedRevenue`: el pendiente se piso en 0 en vez de mostrarse negativo. |
| `generateMonthlyPayments` | Solo re-sincroniza montos de PENDING/EXPIRED, que nunca tienen ajuste. Los PAID no se tocan. |
| Recordatorio de WhatsApp | Avisa el monto de la cuota sin ajustar, que es lo correcto: el ajuste depende de con qué termine pagando. |

**Si algún día se agregan medios de pago propios del gimnasio**, la config ya es por gimnasio y la
UI se arma con lo que devuelve la API (nunca con una lista fija), así que el cambio queda acotado a:
`PaymentMethod` (enum → tabla con `id` y `label`), las columnas fijas de `CashClosing`
(`cashTotal`/`transferTotal`/`cardTotal` → tabla hija por medio, mapeadas hoy en `closingBreakdown`
de `PaymentsView`), y `PAYMENT_METHOD_LABEL` / `PaymentMethodIcon`, que pasarían a salir de la config.

### Recargo por mora

`LateFeeConfig` (`modules/late-fees/`) es la regla de un gimnasio para cobrarle de más a la cuota que
se paga fuera de término. Una sola fila por gimnasio; sin fila, la regla está apagada — que es como
venían funcionando todos. Cuatro parámetros la definen:

| Campo | Qué controla |
|---|---|
| `graceDays` | Días de tolerancia después del vencimiento antes de que empiece a correr |
| `feeType` + `feeValue` | Cuánto: un monto fijo (`FIXED`) o un % de la cuota (`PERCENT`) |
| `repeatEveryDays` | Cada cuántos días se vuelve a aplicar mientras siga impaga. `null` = una sola vez |
| `maxCharges` | Tope opcional de veces que puede cobrarse (solo con repetición) |
| `maxFeeAmount` | Tope opcional del recargo acumulado, en pesos |

Los dos topes son independientes y se pueden combinar: corta el que llegue primero. La cuenta de
aplicaciones es por bloque empezado — con `repeatEveryDays: 7`, ocho días de atraso ya son dos.

- **Configuración**: `/[gymId]/settings`, solo owner. `GET /api/late-fee` lo leen owner y
  recepcionista (necesita previsualizar lo que va a cobrar); `PATCH` es del owner.
- **Cuándo se calcula**: al cobrar, no al generar la cuota. Un pago PENDING/EXPIRED guarda siempre la
  cuota limpia en `amount` — el recargo sigue corriendo, así que congelarlo antes sería mentir. La
  vista lo previsualiza con la misma fórmula (`lib/late-fee.ts`) y el backend lo recalcula y lo
  congela en `Payment.lateFee` / `lateDays` recién en el `PATCH` que marca el pago.
- **Contra qué fecha**: contra `paidAt`, no contra hoy. Reeditarle el medio a un pago viejo no le
  suma atraso que nunca existió.
- **Orden de las dos reglas**: la mora entra primero, el ajuste del medio de pago después, sobre la
  deuda ya con la mora incluida. La descomposición guardada es
  `amount = baseAmount + lateFee + methodAdjustment`, con `baseAmount` = la cuota limpia.
  Al despagar, `amount` vuelve a `baseAmount` y se limpia todo lo demás.
- **Dos formas de no cobrarlo**: `Student.lateFeeExempt` exime al alumno de forma permanente (beca,
  arreglo particular) y `Payment.lateFeeWaived` condona una cuota puntual desde el modal de cobro.
  Ambas dejan `lateDays` cargado — lo que se perdona es el monto, no el registro del atraso. La
  condonación es de ese cobro: al despagar se limpia junto con el resto, así que la cuota vuelve a
  deber la mora que corresponda.

**Dónde impacta**:

| Lugar | Efecto |
|---|---|
| `generateMonthlyPayments` | Re-sincroniza el `amount` de PENDING/EXPIRED con el precio de los grupos. No lo toca la mora, que nunca se guarda antes de cobrar. |
| `expireOverduePayments` | Sigue decidiendo PENDING/EXPIRED por el vencimiento; la mora no cambia el estado, solo el monto al cobrar. |
| `cash-closings` / métricas | La mora entra en `amount`, así que suma como ingreso real igual que un recargo por medio de pago. |
| `totalPendingRevenue` | Es la cuota sin mora: lo acumulado todavía no se cobró y podría condonarse. |
| Recordatorio de WhatsApp | Si ya corrió mora, el aviso manda el total de hoy — avisar solo la cuota sería un número que después no coincide con el cobro. |

### Route groups
- `app/(auth)/` — public routes (`/login`)
- `app/(dashboard)/` — protected routes. Entradas por rol: `/dashboard` (owner), `/admin`,
  `/trainer`, `/reception`. El área `/[gymId]` la comparten owner y recepcionista.
- `app/api/auth/[...nextauth]/` — NextAuth handler, do not modify.

### Tests (Vitest, `tests/`)

No hay DB en los tests: `tests/mocks/db.ts` es un fake de Prisma que implementa `findFirst` /
`findMany` sobre arrays en memoria. Los `belongs` corren **de verdad** contra ese fixture, así que
los tests de acceso cubren la cadena rol → belongs → handler y no una versión mockeada de sí misma.
Lo que sí se mockea: `@/lib/auth` (la sesión), `@/lib/logger` y los servicios de dominio.

| Archivo | Qué fija |
|---|---|
| `tests/api-access.test.ts` | Matriz de acceso sobre los route handlers reales: qué toca cada rol, aislamiento entre gimnasios, recepcionista desactivado, sin sesión |
| `tests/belongs.test.ts` | Los predicados de autorización, incluido `active: false` |
| `tests/role-routing.test.ts` | Ruteo por rol del proxy + invariante de que ningún redirect encadena otro |
| `tests/guards.test.ts` | `requireGymRole` y su fallback por rol |
| `tests/receptionists.service.test.ts` | Alta transaccional, email duplicado, hash de contraseña, borrado por cascade |
| `tests/payment-methods.test.ts` | Cálculo del recargo/descuento, cobro con la config del gimnasio, medio deshabilitado, invariante de "al menos uno habilitado" |
| `tests/late-fee.test.ts` | Días de atraso y fórmula de la mora, orden mora → medio de pago, exención y condonación, congelado contra `paidAt`, validación de la regla |

Al agregar un endpoint que acepte más de un rol, sumalo al catálogo de `api-access.test.ts`: las
listas `RECEPTIONIST_ALLOWED` / `RECEPTIONIST_DENIED` son la definición ejecutable de los permisos.

### Guards de página
`proxy.ts` solo mira el rol del JWT (corre en edge, sin DB): manda cada rol a su entrada y bloquea
las áreas ajenas. Lo que necesita DB va en server components:
- `app/(dashboard)/[gymId]/layout.tsx` — pertenencia al gimnasio (`gymBelongsToOwner` /
  `gymBelongsToReceptionist`) y `gymIsActive`. Al recepcionista lo devuelve a `/reception`, no a
  `/dashboard` — si no, el proxy lo rebota acá en loop.
- `requireGymRole(gymId, roles)` de `lib/guards.ts` — en cada `page.tsx` de `/[gymId]`, para
  separar las secciones del owner de las compartidas.
- `app/(dashboard)/reception/page.tsx` — única pantalla terminal del recepcionista: lo manda a su
  gimnasio, o explica por qué no puede entrar (acceso desactivado / gimnasio suspendido).

### Env vars (`.env.local`)
```
DATABASE_URL="postgresql://postgres.PROJECT:PASSWORD@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
AUTH_SECRET=""   # generate: npx auth secret
AUTH_URL="http://localhost:3000"
```

### Auth flow
1. `proxy.ts` intercepts every request — no session → redirect `/login`
2. Login form calls `signIn("credentials", { email, password, redirect: false })`
3. `lib/auth.ts` → `db.user.findUnique` + `bcrypt.compare` → returns `{ id, email, role }`
4. NextAuth issues JWT cookie with `id` and `role`
5. Server components call `auth()` to read session: `session.user.id`, `session.user.role`

### Folder structure

```
lib/                        ← Infrastructure / config (no business logic)
  auth.ts                   ← NextAuth config
  db.ts                     ← Prisma singleton
  utils.ts                  ← cn() helper

modules/                    ← Business logic, one folder per domain
  belongs/
    belongs.service.ts      ← Belongs checks (retornan boolean), usados en route handlers
  gyms/
    gyms.service.ts         ← DB queries (sin lógica de autorización)
    gyms.schema.ts          ← Zod input validation + inferred types
  students/
  trainers/
  receptionists/
  groups/
  schedules/
  payment-methods/          ← Config por gimnasio de cada medio de pago
  late-fees/                ← Regla de recargo por mora del gimnasio

app/api/                    ← HTTP layer only (thin controllers)
  auth/[...nextauth]/       ← NextAuth internals, do not touch
  gyms/
    route.ts                ← GET /api/gyms, POST /api/gyms
    [id]/route.ts           ← GET, PATCH, DELETE /api/gyms/:id
  students/
  trainers/
  receptionists/
  groups/
  schedules/

app/(auth)/                 ← Public pages
app/(dashboard)/            ← Protected pages
```

### Backend architecture — Route Handlers only

All backend logic lives in `modules/` (services + schemas). `app/api/` route handlers are thin: auth check → validate input → call service → return response. No Server Actions.

This keeps frontend/backend cleanly separated and allows a future mobile app to consume the same API.

**Auth strategy:**
- Web: NextAuth cookie session. Route Handlers verify via `auth()` from `lib/auth.ts`.
- Mobile (future): Bearer token in `Authorization` header. Will be added when mobile app is built.

**Route Handler pattern:**
```ts
// app/api/students/route.ts — auth → belongs → service
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { getStudentsByGym, createStudent } from "@/modules/students/students.service"
import { createStudentSchema } from "@/modules/students/students.schema"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await getStudentsByGym(gymId))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createStudentSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!await gymBelongsToOwner(parsed.data.gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await createStudent(parsed.data), { status: 201 })
}
```

### Adding new features
- **New DB models**: add to `prisma/schema.prisma`, run `prisma migrate dev --name desc`, then `prisma generate`
- **New domain**: create `modules/<domain>/<domain>.service.ts` + `<domain>.schema.ts`, then `app/api/<domain>/route.ts`
- **Import Prisma types**: `import type { Student, Group } from "@/app/generated/prisma/client"`
- **Complex query types**: `import type { Prisma } from "@/app/generated/prisma/client"` → `Prisma.XGetPayload<{ include: ... }>`
- **New protected pages**: place under `app/(dashboard)/` — `proxy.ts` covers them automatically
- **New public routes**: place under `app/(auth)/` or add the path to the proxy matcher exclusions
- **UI components**: `components/ui/` for generic components, `components/layout/` for Sidebar/Navbar

### Logging — OBLIGATORIO en todo route handler

**Regla**: Todo código backend que se escriba o modifique DEBE incluir logs con `logger` de `@/lib/logger`.

```ts
import { logger } from "@/lib/logger"
```

El wrapper `withAuth`/`withAuthParams` ya cubre automáticamente: 401, 403 de auth, inicio de request, status final y duración. Lo que hay que agregar en cada handler:

| Caso | Método | Campos mínimos |
|------|--------|----------------|
| Param requerido faltante (400) | `logger.warn` | nombre del param |
| Validación Zod falla (400) | `logger.warn` | `{ errors: parsed.error.flatten() }` |
| `gymBelongsToOwner` → false (403) | `logger.warn` | `{ gymId, userId: session.user.id }` |
| `<x>BelongsTo<y>` → false (403) | `logger.warn` | IDs relevantes |
| `gymIsActive` → false (403) | `logger.warn` | `{ gymId }` |
| Recurso no encontrado (404) | `logger.warn` | `{ id }` + nombre del recurso |
| Mutación exitosa — POST (201) | `logger.info` | `{ id: result.id }` |
| Mutación exitosa — PATCH (200) | `logger.info` | `{ id }` |
| Mutación exitosa — DELETE (204) | `logger.info` | `{ id }` |
| Error en catch | `logger.error` | `{ error: String(err), ...ids }` |

**GET (reads)**: no requieren `logger.info` en éxito — el wrapper ya loguea `← GET /path 200`.

Ejemplo completo:
```ts
export const POST = withAuth([UserRole.OWNER], async (req, session) => {
  const body = await req.json()
  const parsed = createStudentSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  if (!await gymBelongsToOwner(parsed.data.gymId, session.user.id)) {
    logger.warn("gymBelongsToOwner failed", { gymId: parsed.data.gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const student = await createStudent(parsed.data)
  logger.info("Student created", { id: student.id })
  return NextResponse.json(student, { status: 201 })
})