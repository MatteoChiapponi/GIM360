import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { resolveRoleRedirect } from "@/lib/role-routing"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthRoute = req.nextUrl.pathname.startsWith("/login")

  if (!isLoggedIn && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (isLoggedIn) {
    const role = req.auth?.user?.role
    if (!role) return

    const redirectTo = resolveRoleRedirect(role, req.nextUrl.pathname)
    if (redirectTo) {
      return NextResponse.redirect(new URL(redirectTo, req.url))
    }
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
