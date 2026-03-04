---
name: new-feature
description: Create a complete backend feature for GYM360 (schema + service + route handlers) for a domain that already exists in the Prisma schema.
argument-hint: <domain>
allowed-tools: Read, Write, Bash, Glob
---

# Create full backend feature for: $ARGUMENTS

Runs the full pipeline: schema → service → routes.

## Step 1 — Read context
- `CLAUDE.md`
- `prisma/schema.prisma` — find the `$ARGUMENTS` model
- `modules/students/students.schema.ts` — reference pattern for schema
- `modules/students/students.service.ts` — reference pattern for service

## Step 2 — Create schema
Follow `/new-schema` rules. Output: `modules/$ARGUMENTS/$ARGUMENTS.schema.ts`

Key rules:
- Exclude: `id`, `createdAt`, `updatedAt`, `fechaAlta`, `fechaBaja`
- DateTime → `z.string().datetime()` (ISO string)
- Enums → `z.nativeEnum(Enum)` imported from `@/app/generated/prisma/client`
- `updateSchema` = `createSchema.omit({ gymId: true, ...otherFKs }).partial()`

## Step 3 — Create service
Follow `/new-service` rules. Output: `modules/$ARGUMENTS/$ARGUMENTS.service.ts`

Key rules:
- Services are pure data access — NO ownership filters, NO ownerId params
- Use `update`/`delete` by single `id` (auth is handled separately in route handlers)
- Soft delete if model has `estado Boolean` → `update({ where: { id }, data: { estado: false } })`
- Convert ISO date strings to `new Date()` in service

## Step 4 — Create route handlers
Follow `/new-route` rules.

Output:
- `app/api/$ARGUMENTS/route.ts` → GET (list by gymId) + POST (create)
- `app/api/$ARGUMENTS/[id]/route.ts` → GET + PATCH + DELETE

Key rules:
- Auth check first on every method
- `params` is `Promise<{ id: string }>` in Next.js 16 → always `await params`
- 201 on create, 204 on delete, 404 if not found

## Step 5 — Verify
Run `npx tsc --noEmit`. Fix all errors before finishing.

## Report
List all files created and endpoints available.