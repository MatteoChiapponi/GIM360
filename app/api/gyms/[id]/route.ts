import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { gymBelongsToOwner } from "@/modules/belongs/belongs.service"
import { updateGymSchema } from "@/modules/gyms/gyms.schema"
import { getGymById, updateGym, deleteGym } from "@/modules/gyms/gyms.service"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const gym = await getGymById(id)
  if (!gym) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!await gymBelongsToOwner(gym.id, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(gym)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const gym = await getGymById(id)
  if (!gym) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!await gymBelongsToOwner(gym.id, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = updateGymSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  return NextResponse.json(await updateGym(id, parsed.data))
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const gym = await getGymById(id)
  if (!gym) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!await gymBelongsToOwner(gym.id, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await deleteGym(id)
  return new NextResponse(null, { status: 204 })
}
