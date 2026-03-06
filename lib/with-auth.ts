import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import type { Session } from "next-auth"
import { UserRole } from "@/app/generated/prisma/client"

type AuthedHandler = (req: NextRequest, session: Session) => Promise<Response>
type AuthedParamsHandler<P> = (req: NextRequest, session: Session, params: P) => Promise<Response>

/** Wraps a Route Handler enforcing authentication and role-based access. */
export function withAuth(roles: UserRole[], handler: AuthedHandler) {
  return async (req: NextRequest) => {
    const session = await auth()
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!roles.includes(session.user.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    return handler(req, session)
  }
}

/** Same as withAuth but for dynamic routes that receive params (e.g. /[id]). */
export function withAuthParams<P>(roles: UserRole[], handler: AuthedParamsHandler<P>) {
  return async (req: NextRequest, { params }: { params: Promise<P> }) => {
    const session = await auth()
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    if (!roles.includes(session.user.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    return handler(req, session, await params)
  }
}
