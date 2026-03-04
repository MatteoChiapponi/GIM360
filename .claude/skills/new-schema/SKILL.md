---
name: new-schema
description: Create a Zod validation schema for a GYM360 domain module.
argument-hint: <domain>
allowed-tools: Read, Write, Glob
---

# Create Zod schema for: $ARGUMENTS

## Step 1 — Read the Prisma model
Read `prisma/schema.prisma` and find the model matching `$ARGUMENTS`.

## Step 2 — Map fields to Zod

**Never include in schema:** `id`, `createdAt`, `updatedAt`, `fechaAlta`, `fechaBaja` — DB-managed.

**Type mapping:**
| Prisma | Zod |
|---|---|
| `String` | `z.string().min(1)` |
| `String?` | `z.string().optional()` |
| `Int` | `z.number().int()` |
| `Decimal` | `z.number()` |
| `Boolean` | `z.boolean()` |
| `DateTime` | `z.string().datetime()` (ISO string, service converts to `new Date()`) |
| `DateTime?` | `z.string().datetime().optional()` |
| `SomeEnum` | `z.nativeEnum(SomeEnum)` |
| `SomeEnum?` | `z.nativeEnum(SomeEnum).optional()` |
| Relation FK (e.g. `gymId`) | `z.string().min(1)` |

**Import enums from:** `@/app/generated/prisma/client`

## Step 3 — Write the file

Output to `modules/$ARGUMENTS/$ARGUMENTS.schema.ts`:

```ts
import { z } from "zod"
// import enums if needed: import { SomeEnum } from "@/app/generated/prisma/client"

export const create${Domain}Schema = z.object({
  // fields here — exclude id, createdAt, updatedAt, fechaAlta, fechaBaja
})

export const update${Domain}Schema = create${Domain}Schema
  .omit({ gymId: true })  // omit all FK fields
  .partial()

export type Create${Domain}Input = z.infer<typeof create${Domain}Schema>
export type Update${Domain}Input = z.infer<typeof update${Domain}Schema>
```

Done. Report the file created and any decisions made (fields excluded and why).