---
name: prisma-change
description: Make a change to the Prisma schema (add model, add field, modify relation), run migration and regenerate the client.
argument-hint: "<description of change>"
allowed-tools: Read, Edit, Write, Bash
---

# Prisma schema change: $ARGUMENTS

## Step 1 — Read current schema
Read `prisma/schema.prisma` in full.

## Step 2 — Apply the change
Edit `prisma/schema.prisma` with the requested change: $ARGUMENTS

Rules:
- New models: always include `id String @id @default(cuid())` and `createdAt DateTime @default(now())`
- New relations: add both sides (model + inverse relation array)
- New enums: add before the models that use them
- Optional fields use `?`
- Never edit `app/generated/prisma/` — auto-generated

## Step 3 — Migrate
```bash
npx prisma migrate dev --name <short-description-of-change>
```
If it fails, read the error and fix the schema before retrying.

## Step 4 — Regenerate client
```bash
npx prisma generate
```

## Step 5 — Check impact
After generating, check if any existing service or schema files reference the changed model and need updating:
- New required field added? → update Zod schemas in `modules/` that create/update this model
- Model renamed? → update all imports
- Field removed? → remove from Zod schemas and service queries

## Step 6 — Verify
Run `npx tsc --noEmit`. Fix any type errors caused by the schema change.

## Report
- What changed in `prisma/schema.prisma`
- Migration name created
- Any downstream files updated