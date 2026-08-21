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
| `lib/money.ts` | `round2()`, `formatMoney()` y `signedMoney()` — el redondeo de todo monto que se guarda, compartido por servicios y vistas |
| `lib/payment-methods.ts` | Parte client-safe de los medios de pago: valores, etiquetas y la fórmula del ajuste |
| `lib/charge.ts` | `ruledCharge()` — el orden de las reglas (mora primero, medio después), compartido por el modal de cobro y el backend |
| `lib/late-fee.ts` | Parte client-safe de la mora: vencimiento, días de atraso y la fórmula del recargo |
| `lib/timezone.ts` | **La zona horaria del proyecto: Argentina.** Todo cálculo de fecha pasa por acá — ver más abajo |
| `instrumentation.ts` | Arranque del server: le clava `process.env.TZ` en `America/Argentina/Buenos_Aires` |
| `proxy.ts` | Route guard — sin sesión → `/login`; con sesión, manda cada rol a su área |
| `lib/guards.ts` | `requireGymRole(gymId, roles)` — guard de rol para páginas de `/[gymId]` |
| `lib/with-auth.ts` | `withAuth(roles, handler)` / `withAuthParams` — auth + rol + logging del request |
| `prisma/schema.prisma` | All DB models and enums |
| `prisma.config.ts` | Loads `.env.local` (override) then `.env`; passes `DATABASE_URL` to Prisma CLI |
| `types/next-auth.d.ts` | Extends `Session` type to include `user.id` and `user.role` |
| `scripts/seed.ts` | Creates test Owner user — runs standalone with `npx tsx` |

### Zona horaria — Argentina, siempre

El servidor corre en Estados Unidos y los gimnasios están en Argentina. Un `Date` es un instante
absoluto y eso no es problema; el problema aparece en cuanto se pregunta **qué día** es:
`getDate()`, `getMonth()`, `getDay()` y `new Date(y, m, d)` contestan en la zona del runtime, que
en el backend es la de Estados Unidos y en el frontend la de la máquina del usuario.

**Regla**: no se usan los accesores locales de `Date`. Todo pasa por `lib/timezone`.

La zona se fija en varios lugares que se complementan:

| Dónde | Qué cubre |
|---|---|
| `instrumentation.ts` | Setea `process.env.TZ` al arrancar el server. Cubre todo el backend en producción |
| `next.config.ts` | Lo mismo, para el proceso del build y el server de dev |
| `lib/timezone.ts` | Cálculo explícito, sin depender del runtime. Es lo único que sirve en el navegador |
| `vitest.config.mts` | Los tests corren en la zona de Argentina, igual que producción |

`process.env.TZ` sola no alcanza: el código "use client" corre en la máquina del usuario, donde esa
variable no existe. Por eso los helpers de `lib/timezone` no leen la hora local del runtime.

```ts
import {
  todayISO,        // "2026-08-20" — el día de hoy en Argentina
  currentPeriod,   // "2026-08"    — el mes en curso en Argentina
  toISODate,       // Date → "YYYY-MM-DD" argentino
  fromISODate,     // "YYYY-MM-DD" → medianoche argentina
  toPeriod,        // Date → "YYYY-MM" argentino
  argentinaDate,   // (2026, 8, 20) → el instante de esa medianoche argentina
  argentinaParts,  // Date → { year, month, day, hour, minute, second, weekday }
  startOfDay, endOfDay, addDays, daysInMonth, isSameDay,
  weekday, weekdayName,          // 0 = domingo / "THURSDAY"
  formatDate, formatDateTime, formatTime, formatMonthYear,
} from "@/lib/timezone"
```

Equivalencias, para no volver a escribir el bug:

| En vez de | Va |
|---|---|
| `new Date(y, m - 1, d)` | `argentinaDate(y, m, d)` — `m` de 1 a 12 |
| `d.getFullYear()` / `getMonth()` / `getDate()` | `argentinaParts(d)` |
| `d.getDay()` | `weekday(d)` / `weekdayName(d)` |
| `d.toLocaleDateString("es-AR")` | `formatDate(d)` |
| `` `${y}-${m}` `` armado a mano | `toPeriod(d)` / `currentPeriod()` |
| `new Date(inputDate).toISOString()` (input `type="date"`) | `fromISODate(inputDate).toISOString()` |

Lo que **sí** puede seguir usando `Date` pelado: `new Date()` y `Date.now()` para marcar un
instante (`paidAt`, duración de un request, nombre de archivo), y `new Date(isoString)` para
parsear un ISO completo. Todo eso es absoluto y no depende de la zona.

Dos convenciones de la DB que ya existían y no cambian:
- `Payment.period` se guarda como el primer día del mes a medianoche **UTC** (`Date.UTC`).
- `Attendance.date` se guarda como día calendario a medianoche **UTC**. El "hoy" que se manda
  desde la UI sale de `todayISO()`, así que es el día argentino.

`tests/timezone.test.ts` corre los helpers con `process.env.TZ` en cuatro zonas distintas y exige
el mismo resultado en todas: es la red que impide que vuelva a colarse un cálculo con hora local.

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
inscribirlos en grupos, generar las cuotas del mes, registrar pagos y cancelarlos mientras no haya
cierre de caja de por medio, y cargar asistencias.
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
  ajuste — y `lib/charge.ts` compone esa fórmula con la mora en el orden que corresponde. Las dos
  las importan tanto las vistas como el backend: que la cuenta sea una sola es lo que garantiza que
  la vista previa del modal y el cobro no puedan dar distinto.
- **Cobro**: el ajuste lo calcula el backend en `PATCH /api/payments/:id`, nunca el cliente. Guarda
  `baseAmount` (la cuota), `methodAdjustment` (firmado) y deja en `amount` el monto realmente
  cobrado, que es el que suman cierres de caja y métricas (ahí también entra el ajuste manual, ver
  más abajo). Cobrar con un medio deshabilitado da 400.
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
- **Orden de las reglas**: la mora entra primero, el ajuste del medio de pago después, sobre la
  deuda ya con la mora incluida, y al final el ajuste manual de quien cobra. La descomposición
  guardada es `amount = baseAmount + lateFee + methodAdjustment + manualAdjustment`, con
  `baseAmount` = la cuota limpia. Al despagar, `amount` vuelve a `baseAmount` y se limpia todo lo
  demás.
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

### Ajuste manual al cobrar

Las dos reglas de arriba las define el gimnasio de antemano. Arriba de las dos está la persona que
cobra: redondeó, le faltaban doscientos pesos, se arregló por otra cifra. Eso se registra como
`Payment.manualAdjustment` — la diferencia firmada entre lo que dieron las reglas y lo que se cobró
de verdad — con `manualAdjustmentReason` para dejar dicho por qué. Lo pueden hacer el owner y la
recepcionista, que son los dos que cobran.

- **Qué manda el cliente**: `chargedAmount`, el monto que se cobró. No manda el ajuste: el backend
  rehace la cuenta de las reglas y la diferencia contra ese monto es el ajuste. Solo viaja cuando
  alguien tocó el monto — mandarlo siempre convertiría en "ajuste manual" cualquier diferencia con
  la cuenta del backend, que para una cuota vencida cambia con los días.
- **Contra qué se mide**: contra cuota + mora + ajuste del medio, o sea el total ya con las dos
  reglas aplicadas. Cambiar el medio o condonar la mora mueve ese total, y el modal reescribe el
  monto sugerido: un redondeo hecho sobre otro total no describe este cobro.
- **Qué lo borra**: `chargedAmount: null` (vuelve al monto calculado) y despagar, que se lleva todo.
  Una edición que no manda `chargedAmount` lo conserva: corregirle el medio a un pago cobrado no
  borra el redondeo que se le hizo al alumno.
- **El piso**: `amount` nunca queda negativo, y el ajuste guardado se deriva del monto final, así que
  la descomposición cierra siempre.

**Dónde impacta**:

| Lugar | Efecto |
|---|---|
| `cash-closings` | `amount` ya lo trae, así que los totales por medio salen bien. El cierre además guarda `adjustmentsCount` / `adjustmentsTotal`: cuánto de lo cobrado salió de ajustes hechos a mano, para poder mirarlo contra lo que decían las cuotas |
| `gym-metrics` y las métricas por grupo | Igual que el ajuste del medio: entra en lo cobrado, que es plata que entró (o que se resignó) de verdad |
| `totalPendingRevenue` | No lo ve: el ajuste se decide al cobrar, y lo que está impago todavía vale lo que dice la cuota |
| Recordatorio de WhatsApp | Tampoco: avisa lo que hay que pagar, no lo que se va a terminar acordando en el mostrador |

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
| `tests/timezone.test.ts` | Los helpers de fecha, corridos en cuatro zonas de runtime: el resultado no puede cambiar |
| `tests/payment-methods.test.ts` | Cálculo del recargo/descuento, cobro con la config del gimnasio, medio deshabilitado, invariante de "al menos uno habilitado" |
| `tests/late-fee.test.ts` | Días de atraso y fórmula de la mora, orden mora → medio de pago, exención y condonación, congelado contra `paidAt`, validación de la regla |
| `tests/manual-adjustment.test.ts` | El monto ajustado a mano al cobrar: el ajuste como diferencia contra las reglas, qué lo borra y qué lo conserva, y su resumen en el cierre de caja. `expectSoundCharge()` corre en cada cobro las invariantes que no pueden romperse nunca: la descomposición que cierra, el piso en 0, el motivo atado al ajuste y que `chargedAmount` no llegue a la DB |

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
  timezone.ts               ← Zona horaria del proyecto (Argentina) — todo cálculo de fecha

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