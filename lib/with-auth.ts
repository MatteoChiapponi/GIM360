import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { UserRole } from "@/app/generated/prisma/client"
import { logger } from "@/lib/logger"

type AuthedHandler = (req: NextRequest, session: Session) => Promise<Response>
type AuthedParamsHandler<P> = (req: NextRequest, session: Session, params: P) => Promise<Response>

/** Wraps a Route Handler enforcing authentication and role-based access. */
export function withAuth(roles: UserRole[], handler: AuthedHandler) {
  return async (req: NextRequest) => {
    const requestId = crypto.randomUUID().slice(0, 8)
    const start = Date.now()
    const path = req.nextUrl.pathname
    const base = { requestId, method: req.method, path }

    const session = await auth()
    if (!session) {
      logger.warn("Unauthorized", base)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!roles.includes(session.user.role)) {
      logger.warn("Forbidden", { ...base, userId: session.user.id, role: session.user.role })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: userId, role } = session.user
    logger.info(`→ ${req.method} ${path}`, { requestId, userId, role })

    try {
      const res = await handler(req, session)
      logger.info(`← ${req.method} ${path} ${res.status}`, { requestId, userId, role, durationMs: Date.now() - start })
      return res
    } catch (err) {
      logger.error(`✕ ${req.method} ${path}`, { requestId, userId, role, durationMs: Date.now() - start, error: String(err) })
      throw err
    }
  }
}

/** Same as withAuth but for dynamic routes that receive params (e.g. /[id]). */
export function withAuthParams<P>(roles: UserRole[], handler: AuthedParamsHandler<P>) {
  return async (req: NextRequest, { params }: { params: Promise<P> }) => {
    const requestId = crypto.randomUUID().slice(0, 8)
    const start = Date.now()
    const path = req.nextUrl.pathname
    const base = { requestId, method: req.method, path }

    const session = await auth()
    if (!session) {
      logger.warn("Unauthorized", base)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!roles.includes(session.user.role)) {
      logger.warn("Forbidden", { ...base, userId: session.user.id, role: session.user.role })
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: userId, role } = session.user
    logger.info(`→ ${req.method} ${path}`, { requestId, userId, role })

    try {
      const res = await handler(req, session, await params)
      logger.info(`← ${req.method} ${path} ${res.status}`, { requestId, userId, role, durationMs: Date.now() - start })
      return res
    } catch (err) {
      logger.error(`✕ ${req.method} ${path}`, { requestId, userId, role, durationMs: Date.now() - start, error: String(err) })
      throw err
    }
  }
}
