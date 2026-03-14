import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym } from "@/modules/belongs/belongs.service"
import { getGroupById, updateGroup, deleteGroup } from "@/modules/groups/groups.service"
import { updateGroupSchema } from "@/modules/groups/groups.schema"

type Params = { id: string }

export const GET = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await groupBelongsToGym(id, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const group = await getGroupById(id)
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(group)
})

export const PATCH = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await groupBelongsToGym(id, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = updateGroupSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  return NextResponse.json(await updateGroup(id, parsed.data))
})

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await groupBelongsToGym(id, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await deleteGroup(id)
  return new NextResponse(null, { status: 204 })
})
