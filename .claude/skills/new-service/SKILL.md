---
name: new-service
description: Create a service file for a GYM360 domain module with CRUD operations. Services are pure data access — no authorization logic.
argument-hint: <domain>
allowed-tools: Read, Write, Glob
---

# Create service for: $ARGUMENTS

## Step 1 — Read context
- `modules/$ARGUMENTS/$ARGUMENTS.schema.ts` — get input types
- `prisma/schema.prisma` — find the model, check if it has `estado Boolean` (soft delete)

## Step 2 — Determine delete strategy

- Model has `estado Boolean`? → **soft delete** (`update` setting `estado: false`)
- No `estado`? → **hard delete** (`delete`)

## Step 3 — Write the file

Services are pure data access. NO ownership filters embedded here — authorization is handled in route handlers via `modules/belongs/belongs.service.ts`.

Output to `modules/$ARGUMENTS/$ARGUMENTS.service.ts`:

```ts
import { db } from "@/lib/db"
import type { Create${Domain}Input, Update${Domain}Input } from "./$ARGUMENTS.schema"

export async function get${Domain}sByGym(gymId: string) {
  return db.$ARGUMENTS.findMany({
    where: { gymId },
    orderBy: { createdAt: "desc" },
  })
}

export async function get${Domain}ById(id: string) {
  return db.$ARGUMENTS.findFirst({ where: { id } })
}

export async function create${Domain}(data: Create${Domain}Input) {
  return db.$ARGUMENTS.create({
    data: {
      ...data,
      // convert ISO strings: fieldName: data.fieldName ? new Date(data.fieldName) : undefined,
    },
  })
}

export async function update${Domain}(id: string, data: Update${Domain}Input) {
  return db.$ARGUMENTS.update({
    where: { id },
    data: {
      ...data,
      // convert ISO strings if any
    },
  })
}

// Soft delete if model has `estado`, otherwise hard delete
export async function delete${Domain}(id: string) {
  return db.$ARGUMENTS.delete({ where: { id } })
  // If soft delete: return db.$ARGUMENTS.update({ where: { id }, data: { estado: false } })
}
```

Done. Report the file created and whether soft or hard delete was used.