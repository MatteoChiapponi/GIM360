import { NextResponse } from "next/server"
import { UserRole } from "@/app/generated/prisma/client"
import { withAuthParams } from "@/lib/with-auth"
import { gymBelongsToOwner, trainerCanAccessAttendance } from "@/modules/belongs/belongs.service"
import { submitAttendance, getAttendanceById } from "@/modules/attendance/attendance.service"
import { submitAttendanceSchema } from "@/modules/attendance/attendance.schema"
import { getTrainerByUserId } from "@/modules/trainers/trainers.service"
import { getOwnerByUserId } from "@/modules/gyms/gyms.service"
import { logger } from "@/lib/logger"

type Params = { id: string }

export const PATCH = withAuthParams<Params>(
  [UserRole.TRAINER, UserRole.OWNER, UserRole.RECEPTIONIST],
  async (req, session, { id }) => {
    let submitterName: string

    if (session.user.role === "TRAINER") {
      const trainer = await getTrainerByUserId(session.user.id)
      if (!trainer) {
        logger.warn("Trainer not found", { id: session.user.id })
        return NextResponse.json({ error: "Trainer not found" }, { status: 404 })
      }
      if (!(await trainerCanAccessAttendance(trainer.id, id))) {
        logger.warn("trainerCanAccessAttendance failed", { trainerId: trainer.id, attendanceId: id })
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      submitterName = trainer.name
    } else {
      // OWNER / RECEPTIONIST
      const attendance = await getAttendanceById(id)
      if (!attendance) {
        logger.warn("Attendance not found", { id })
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      if (!(await gymBelongsToOwner(attendance.gymId, session.user.id))) {
        logger.warn("gymBelongsToOwner failed", { gymId: attendance.gymId, userId: session.user.id })
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      const owner = await getOwnerByUserId(session.user.id)
      submitterName = owner?.name ?? session.user.id
    }

    const body = await req.json()
    const parsed = submitAttendanceSchema.safeParse(body)
    if (!parsed.success) {
      logger.warn("Validation error", { errors: parsed.error.flatten() })
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const updated = await submitAttendance(id, parsed.data.students, session.user.id, submitterName)
    logger.info("Attendance updated", { id })
    return NextResponse.json(updated)
  },
)
