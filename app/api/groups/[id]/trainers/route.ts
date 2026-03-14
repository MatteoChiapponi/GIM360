import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym, trainerBelongsToGym } from "@/modules/belongs/belongs.service"
import { assignTrainer } from "@/modules/groups/groups.service"

type Params = { id: string }

const assignSchema = z.object({
  trainerId: z.string().min(1),
  hourlyRate: z.number().positive().optional(),
})

export const POST = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id: groupId }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await groupBelongsToGym(groupId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  if (!await trainerBelongsToGym(parsed.data.trainerId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  return NextResponse.json(await assignTrainer(groupId, parsed.data.trainerId, parsed.data.hourlyRate), { status: 201 })
})
