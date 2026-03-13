"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function NavLinks({ gymId }: { gymId: string }) {
  const pathname = usePathname()
  const items = [
    { label: "Pagos", href: `/${gymId}/payments` },
    { label: "Métricas", href: `/${gymId}/metrics` },
  ]

  return (
    <nav className="flex items-center gap-0.5">
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
  )
}
