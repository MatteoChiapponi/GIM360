import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthRoute = req.nextUrl.pathname.startsWith("/login")

  if (!isLoggedIn && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (isLoggedIn) {
    const role = req.auth?.user?.role
    const isAdminRoute = req.nextUrl.pathname.startsWith("/admin")

    if (role === "ADMIN" && !isAdminRoute) {
      return NextResponse.redirect(new URL("/admin", req.url))
    }

    if (role !== "ADMIN" && isAdminRoute) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    const isTrainerRoute = req.nextUrl.pathname.startsWith("/trainer")

    if (role === "TRAINER" && !isTrainerRoute) {
      return NextResponse.redirect(new URL("/trainer", req.url))
    }

    if (role !== "TRAINER" && isTrainerRoute) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    // El recepcionista no tiene selector de gimnasios: /reception lo manda al suyo.
    const isReceptionRoute = req.nextUrl.pathname.startsWith("/reception")
    const isGymPicker = req.nextUrl.pathname === "/" || req.nextUrl.pathname === "/dashboard"

    if (role === "RECEPTIONIST" && isGymPicker) {
      return NextResponse.redirect(new URL("/reception", req.url))
    }

    if (role !== "RECEPTIONIST" && isReceptionRoute) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }
  }
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
