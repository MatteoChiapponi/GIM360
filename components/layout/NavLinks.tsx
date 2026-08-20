"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect, useRef } from "react"

/** Secciones que ve el recepcionista. El resto de /[gymId] es solo del owner. */
const RECEPTIONIST_SECTIONS = ["students", "attendance", "payments"]

export function NavLinks({ gymId, role }: { gymId: string; role?: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const allItems = [
    { section: "groups",        label: "Grupos",        href: `/${gymId}/groups` },
    { section: "students",      label: "Alumnos",       href: `/${gymId}/students` },
    { section: "trainers",      label: "Entrenadores",  href: `/${gymId}/trainers` },
    { section: "receptionists", label: "Recepción",     href: `/${gymId}/receptionists` },
    { section: "attendance",    label: "Asistencias",   href: `/${gymId}/attendance` },
    { section: "payments",      label: "Cuotas",        href: `/${gymId}/payments` },
    { section: "discounts",     label: "Descuentos",    href: `/${gymId}/discounts` },
    { section: "expenses",      label: "Gastos",        href: `/${gymId}/expenses` },
    { section: "metrics",       label: "Métricas",      href: `/${gymId}/metrics` },
  ]

  const items = role === "RECEPTIONIST"
    ? allItems.filter((i) => RECEPTIONIST_SECTIONS.includes(i.section))
    : allItems

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [open])

  // Cerrar al cambiar de ruta
  useEffect(() => { setOpen(false) }, [pathname])

  return (
    <>
      {/* Desktop — links inline */}
      <nav className="hidden sm:flex items-center gap-0.5">
        {items.map(({ label, href }) => {
          const active = pathname === href || pathname.startsWith(href + "/")
          return (
            <Link
              key={href}
              href={href}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors min-h-[36px] flex items-center ${
                active
                  ? "bg-[#111110] text-white"
                  : "text-[#68685F] hover:text-[#111110] hover:bg-[#F0EFEB]"
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Mobile — hamburger */}
      <div className="sm:hidden relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Menú"
          className="cursor-pointer flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E4E0] bg-white text-[#68685F] hover:bg-[#F0EFEB] transition-colors"
        >
          {open ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M1 3h12M1 7h12M1 11h12" />
            </svg>
          )}
        </button>

        {open && (
          <div className="absolute right-0 top-[calc(100%+6px)] w-48 rounded-xl border border-[#E5E4E0] bg-white shadow-lg overflow-hidden z-50">
            {items.map(({ label, href }) => {
              const active = pathname === href || pathname.startsWith(href + "/")
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center px-4 py-3 text-sm font-medium transition-colors border-b border-[#F7F6F3] last:border-0 ${
                    active
                      ? "bg-[#F0EFEB] text-[#111110]"
                      : "text-[#68685F] hover:bg-[#FAFAF9] hover:text-[#111110]"
                  }`}
                >
                  {label}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
