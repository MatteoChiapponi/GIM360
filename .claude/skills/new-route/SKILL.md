---
name: new-route
description: Create Route Handler files for a GYM360 domain. Creates route.ts (list+create) and [id]/route.ts (get+update+delete).
argument-hint: <domain>
allowed-tools: Read, Write, Bash, Glob
---

# Create Route Handlers for: $ARGUMENTS

## Step 1 — Read context
- `modules/$ARGUMENTS/$ARGUMENTS.service.ts` — function names to import
- `modules/$ARGUMENTS/$ARGUMENTS.schema.ts` — schema names to import
- `modules/belongs/belongs.service.ts` — which belongs functions are available

## Step 2 — Determine which belongs check to use

Identify the parent entity that guards access to this domain:
- Entity has `gymId` directly → `gymBelongsToOwner(gymId, session.user.id)`
- Entity has `groupId` → `groupBelongsToGym(groupId, gymId)` (first verify gym, then group)
- Adjust for non-owner roles as needed (look up trainer/receptionist entity first)

## Step 3 — Create `app/api/$ARGUMENTS/route.ts`

Pattern: auth → belongs check → service call.

```ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { create${Domain}Schema } from "@/modules/$ARGUMENTS/$ARGUMENTS.schema"
import { get${Domain}sByGym, create${Domain} } from "@/modules/$ARGUMENTS/$ARGUMENTS.service"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await get${Domain}sByGym(gymId))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = create${Domain}Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!await gymBelongsToOwner(parsed.data.gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await create${Domain}(parsed.data), { status: 201 })
}
```

## Step 4 — Create `app/api/$ARGUMENTS/[id]/route.ts`

**Critical:** In Next.js 16, `params` is a `Promise` — always `await params`.

For operations by id: fetch the entity first to get its parent id, then belongs-check.

```ts
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { update${Domain}Schema } from "@/modules/$ARGUMENTS/$ARGUMENTS.schema"
import { get${Domain}ById, update${Domain}, delete${Domain} } from "@/modules/$ARGUMENTS/$ARGUMENTS.service"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const data = await get${Domain}ById(id)
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!await gymBelongsToOwner(data.gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await get${Domain}ById(id)
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!await gymBelongsToOwner(existing.gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = update${Domain}Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  await update${Domain}(id, parsed.data)
  return NextResponse.json({ success: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const existing = await get${Domain}ById(id)
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!await gymBelongsToOwner(existing.gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await delete${Domain}(id)
  return new NextResponse(null, { status: 204 })
}
```

## Step 5 — Verify
Run `npx tsc --noEmit`. Fix any type errors.

Done. Report endpoints created: `GET/POST /api/$ARGUMENTS` and `GET/PATCH/DELETE /api/$ARGUMENTS/:id`.