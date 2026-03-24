"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const form = e.currentTarget
    const email = (form.elements.namedItem("email") as HTMLInputElement).value
    const password = (form.elements.namedItem("password") as HTMLInputElement).value

    const result = await signIn("credentials", { email, password, redirect: false })
    setLoading(false)

    if (result?.error) {
      setError("Email o contraseña incorrectos")
    } else {
      router.push("/dashboard")
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="hidden md:flex md:w-[52%] flex-col justify-between p-14 bg-[#111110] select-none">
        <div>
          <span className="text-[#5A5A58] text-xs font-semibold tracking-[0.2em] uppercase">
            GYM360
          </span>
        </div>

        <div>
          <h1 className="text-white font-bold leading-[0.95] tracking-tight"
              style={{ fontSize: "clamp(52px, 6vw, 88px)" }}>
            Gimnasia<br />Artística.
          </h1>
          <p className="mt-8 text-[#4A4A48] text-sm leading-relaxed max-w-xs">
            Gestión integral para tu gimnasio — pagos, métricas y alumnos en un solo lugar.
          </p>
        </div>

        <div>
          <p className="text-[#2C2C2A] text-xs">© 2025 GYM360</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 bg-[#F7F6F3]">
        <div className="w-full max-w-[340px]">

          {/* Mobile wordmark */}
          <div className="mb-10 md:hidden">
            <span className="text-[#111110] text-xs font-semibold tracking-[0.2em] uppercase">GYM360</span>
          </div>

          <div className="mb-10">
            <h2 className="text-2xl font-semibold text-[#111110]">Iniciar sesión</h2>
            <p className="mt-1.5 text-sm text-[#68685F]">Ingresá a tu cuenta para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block mb-2 text-[10px] font-semibold text-[#A5A49D] uppercase tracking-[0.12em]">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="correo@ejemplo.com"
                className="w-full rounded-lg border border-[#E5E4E0] bg-white px-4 py-3 text-sm text-[#111110] placeholder:text-[#C8C7C3] outline-none focus:border-[#111110] transition-colors"
              />
            </div>

            <div>
              <label className="block mb-2 text-[10px] font-semibold text-[#A5A49D] uppercase tracking-[0.12em]">
                Contraseña
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-[#E5E4E0] bg-white px-4 py-3 pr-11 text-sm text-[#111110] placeholder:text-[#C8C7C3] outline-none focus:border-[#111110] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A5A49D] hover:text-[#68685F] transition-colors cursor-pointer"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="cursor-pointer mt-1 w-full rounded-lg bg-[#111110] px-4 py-3 text-sm font-semibold text-white hover:bg-[#2C2C2A] disabled:opacity-40 transition-colors"
            >
              {loading ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
