# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (http://localhost:3000)
npm run build     # Production build (also runs type check)
npm run lint      # ESLint
npx tsc --noEmit  # Type check only

# Prisma (always run after schema changes)
npx prisma generate          # Regenerate client into app/generated/prisma/
npx prisma migrate dev       # Apply schema changes to DB
npx prisma migrate deploy    # Apply in production
npx prisma studio            # GUI for the DB

# Seed
npx tsx scripts/seed.ts      # Insert test owner (admin@gym360.com / admin1234)
```

After any change to `prisma/schema.prisma`, run `prisma migrate dev` then `prisma generate` before building.

## Architecture

**GYM360** is a multi-tenant SaaS for managing artistic gymnastics gyms. Multiple gyms coexist in a single DB, isolated by `gymId` FK on every entity.

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
| `proxy.ts` | Route guard — unauthenticated requests redirect to `/login` |
| `prisma/schema.prisma` | All DB models and enums |
| `prisma.config.ts` | Loads `.env.local` (override) then `.env`; passes `DATABASE_URL` to Prisma CLI |
| `types/next-auth.d.ts` | Extends `Session` type to include `user.id` and `user.role` |
| `scripts/seed.ts` | Creates test Owner user — runs standalone with `npx tsx` |

### Data model
```
User (auth)
 └── Owner 1:1
      └── Gym[]
           ├── Trainer[]       (optional User 1:1 — trainer may not have login)
           ├── Student[]
           ├── Group[]
           │    ├── TrainerGroup[]  (junction, includes precioHora)
           │    ├── StudentGroup[]  (junction, includes fechaInscripcion)
           │    └── Schedule[]      (diasSemana: DayOfWeek[], horaInicio/Fin: "HH:MM")
           └── FixedExpense[]
```

### Enums (in schema.prisma)
- `UserRole`: `OWNER | TRAINER | RECEPTIONIST`
- `GymStatus`: `ACTIVO | INACTIVO | SUSPENDIDO`
- `ContractType`: `POR_HORA | MENSUAL`
- `MedicalClearance`: `PENDIENTE | APROBADO | VENCIDO`
- `DayOfWeek`: `LUNES | MARTES | MIERCOLES | JUEVES | VIERNES | SABADO | DOMINGO`

### Route groups
- `app/(auth)/` — public routes (`/login`)
- `app/(dashboard)/` — protected routes (`/dashboard`). Sidebar/Navbar to be added to layout.
- `app/api/auth/[...nextauth]/` — NextAuth handler, do not modify.

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

### Adding new features
- **New DB models**: add to `prisma/schema.prisma`, run `prisma migrate dev --name desc`, then `prisma generate`
- **Import types**: `import type { Student, Group } from "@/app/generated/prisma/client"`
- **Complex query types**: `import type { Prisma } from "@/app/generated/prisma/client"` → use `Prisma.XGetPayload<{ include: ... }>`
- **New protected routes**: place under `app/(dashboard)/` — `proxy.ts` covers them automatically
- **New public routes**: place under `app/(auth)/` or add the path to the proxy matcher exclusions
- **UI components**: `components/ui/` for generic components, `components/layout/` for Sidebar/Navbar