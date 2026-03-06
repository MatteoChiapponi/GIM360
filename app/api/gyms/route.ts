import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { UserRole } from "@/app/generated/prisma/client"
import { createGymSchema } from "@/modules/gyms/gyms.schema"
import { getGymsByOwner, getGymById, createGym } from "@/modules/gyms/gyms.service"
import { getTrainerByUserId } from "@/modules/trainers/trainers.service"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (session.user.role === UserRole.OWNER) {
    return NextResponse.json(await getGymsByOwner(session.user.id))
  }

  if (session.user.role === UserRole.TRAINER) {
    const trainer = await getTrainerByUserId(session.user.id)
    if (!trainer) return NextResponse.json({ error: "Trainer not found" }, { status: 404 })
    const gym = await getGymById(trainer.gymId)
    return NextResponse.json(gym ? [gym] : [])
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== UserRole.OWNER)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = createGymSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  return NextResponse.json(await createGym(session.user.id, parsed.data), { status: 201 })
}
