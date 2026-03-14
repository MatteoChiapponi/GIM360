import { NextRequest, NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, groupBelongsToGym, trainerBelongsToGroup } from "@/modules/belongs/belongs.service"
import { removeTrainer } from "@/modules/groups/groups.service"

type Params = { id: string; trainerId: string }

export const DELETE = withAuthParams<Params>([UserRole.OWNER], async (req, session, { id: groupId, trainerId }) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  if (!gymId) return NextResponse.json({ error: "gymId required" }, { status: 400 })

  if (!await gymBelongsToOwner(gymId, session.user.id))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await groupBelongsToGym(groupId, gymId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!await trainerBelongsToGroup(trainerId, groupId))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await removeTrainer(groupId, trainerId)
  return new NextResponse(null, { status: 204 })
})
