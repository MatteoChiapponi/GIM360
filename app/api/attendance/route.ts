import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuth } from "@/lib/with-auth"
import { gymBelongsToUser } from "@/modules/belongs/belongs.service"
import {
  ensureAttendanceUpToDate,
  getAttendanceByGymDate,
  getAttendanceByGymDateRange,
  getTrainerAttendanceForDate,
  getTrainerAttendanceForDateRange,
} from "@/modules/attendance/attendance.service"
import { generateAttendanceSchema } from "@/modules/attendance/attendance.schema"
import { getTrainerByUserId } from "@/modules/trainers/trainers.service"
import { logger } from "@/lib/logger"

export const GET = withAuth([UserRole.TRAINER, UserRole.OWNER], async (req, session) => {
  const gymId = req.nextUrl.searchParams.get("gymId")
  const date = req.nextUrl.searchParams.get("date")
  const dateTo = req.nextUrl.searchParams.get("dateTo")
  if (!gymId || !date) {
    logger.warn("Missing required param: gymId and date")
    return NextResponse.json({ error: "gymId and date required" }, { status: 400 })
  }

  if (!(await gymBelongsToUser(gymId, session.user.id))) {
    logger.warn("gymBelongsToUser failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (session.user.role === "TRAINER") {
    const trainer = await getTrainerByUserId(session.user.id)
    if (!trainer || trainer.gymId !== gymId) {
      logger.warn("Trainer not found or does not belong to gym", { gymId, userId: session.user.id })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (dateTo) {
      return NextResponse.json(await getTrainerAttendanceForDateRange(trainer.id, gymId, date, dateTo))
    }
    return NextResponse.json(await getTrainerAttendanceForDate(trainer.id, gymId, date))
  }

  if (dateTo) {
    return NextResponse.json(await getAttendanceByGymDateRange(gymId, date, dateTo))
  }
  return NextResponse.json(await getAttendanceByGymDate(gymId, date))
})

export const POST = withAuth([UserRole.TRAINER, UserRole.OWNER], async (req, session) => {
  const body = await req.json()
  const parsed = generateAttendanceSchema.safeParse(body)
  if (!parsed.success) {
    logger.warn("Validation error", { errors: parsed.error.flatten() })
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { gymId, date } = parsed.data

  if (!(await gymBelongsToUser(gymId, session.user.id))) {
    logger.warn("gymBelongsToUser failed", { gymId, userId: session.user.id })
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const records = await ensureAttendanceUpToDate(gymId, date)

  if (session.user.role === "TRAINER") {
    const trainer = await getTrainerByUserId(session.user.id)
    if (!trainer || trainer.gymId !== gymId) {
      logger.warn("Trainer not found or does not belong to gym", { gymId, userId: session.user.id })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const result = await getTrainerAttendanceForDate(trainer.id, gymId, date)
    logger.info("Attendance generated for trainer", { trainerId: trainer.id, gymId, date })
    return NextResponse.json(result, { status: 201 })
  }

  logger.info("Attendance generated for gym", { gymId, date, count: records.length })
  return NextResponse.json(records, { status: 201 })
})
