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
discountBelongsToGym(discountId, gymId)
assignmentBelongsToStudent(assignmentId, studentId)  // StudentDiscount.studentId === studentId
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
 │         ├── Student[]           (StudentDiscount[] — descuentos asignados)
 │         ├── Group[]
 │         │    ├── TrainerGroup[]  (junction, includes hourlyRate)
 │         │    │    └── TrainerGroupSchedule[]
 │         │    ├── StudentGroup[]  (junction, includes enrolledAt)
 │         │    ├── Schedule[]      (weekDays: DayOfWeek[], startTime/endTime: "HH:MM")
 │         │    └── Attendance[]
 │         ├── Payment[]  ── CashClosing[]
 │         ├── StudentFile[]
 │         ├── Discount[]         (StudentDiscount[] los asigna a alumnos, con vigencia)
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
Quedan fuera: cierres de caja, gastos, métricas, grupos, entrenadores y descuentos. `active: false` corta el
acceso sin borrar el registro; `DELETE` borra el `User` y arrastra al `Receptionist` por cascade.

### Descuentos → cuotas

`Discount` es del gimnasio y lo configura solo el owner. `StudentDiscount` lo ata a un alumno con
vigencia en períodos mensuales (`validFrom` / `validUntil`, el primer día del mes como `Payment.period`;
`validUntil` null = sin corte). El servicio rechaza vigencias solapadas para un mismo alumno, así que
en cada período hay **a lo sumo un descuento aplicable**.

El descuento se aplica **al generar/sincronizar las cuotas** (`generateMonthlyPayments`), no al
marcarlas pagadas: `baseAmount` es la suma de los grupos, `discountAmount` lo que se descuenta y
`amount` lo que se cobra. Como `amount` sigue siendo el monto final, métricas y cierres de caja no
cambiaron. Las cuotas `PAID` nunca se recalculan — quedan congeladas con `discountName` como
snapshot, que sobrevive incluso al borrado del descuento.

El cálculo vive aislado en `modules/discounts/discounts.calc.ts` (funciones puras, sin DB) para
poder testearlo sin montar un escenario entero.

### Enums (in schema.prisma)
- `UserRole`: `ADMIN | OWNER | TRAINER | RECEPTIONIST`
- `GymStatus`: `ACTIVE | INACTIVE | SUSPENDED`
- `StudentStatus`: `ACTIVE | INACTIVE | TRIAL`
- `PaymentStatus`: `PENDING | PAID | EXPIRED`
- `PaymentMethod`: `CASH | TRANSFER | CARD`
- `StudentFileType`: `FICHA | APTO_MEDICO`
- `DayOfWeek`: `MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY | SUNDAY`
- `DiscountType`: `PERCENTAGE | FIXED_AMOUNT | FIXED_PRICE`

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
| `tests/discounts.calc.test.ts` | El cálculo del descuento: los tres tipos, los topes (nunca negativo, nunca recargo), vigencias y solapamientos |

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
  discounts/
    discounts.calc.ts       ← Cálculo puro del descuento (sin DB) — testeado en tests/discounts.calc.test.ts
    discounts.errors.ts     ← Errores de dominio → status HTTP
    discounts.service.ts
    discounts.schema.ts

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