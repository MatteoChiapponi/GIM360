"use client"

import { signOut } from "next-auth/react"

export function LogoutButton({ label = "Salir" }: { label?: string }) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="cursor-pointer text-xs font-medium text-[#A5A49D] hover:text-[#111110] transition-colors flex-shrink-0 min-h-[44px] flex items-center"
    >
      {label}
    </button>
  )
}
