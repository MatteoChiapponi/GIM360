"use client"

import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"

export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const visible = open || hover

  useLayoutEffect(() => {
    if (!visible || !triggerRef.current) { setPos(null); return }
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 })
  }, [visible])

  useEffect(() => {
    if (!open) return
    function handleOutside(e: PointerEvent) {
      if (triggerRef.current?.contains(e.target as Node)) return
      if (tooltipRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", handleOutside)
    return () => document.removeEventListener("pointerdown", handleOutside)
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex items-center justify-center cursor-default touch-manipulation"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label="Más información"
      >
        <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor" className={`transition-opacity shrink-0 ${visible ? "opacity-90" : "opacity-60"}`}>
          <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
          <text x="6" y="9" textAnchor="middle" fontSize="8" fontWeight="700">?</text>
        </svg>
      </button>
      {visible && pos && createPortal(
        <div
          ref={tooltipRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, transform: "translateX(-50%)" }}
          className="w-56 rounded-lg bg-[#111110] px-3 py-2 text-[11px] font-normal normal-case tracking-normal text-white shadow-lg z-[9999] text-left leading-relaxed"
        >
          {text}
        </div>,
        document.body
      )}
    </>
  )
}
