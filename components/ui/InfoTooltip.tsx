"use client"

import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"

const TOOLTIP_WIDTH = 256
const PADDING = 10

type Pos = { top: number; left: number; above: boolean; ready: boolean }

export function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Pos | null>(null)

  const visible = open || hover

  // Pass 1: compute horizontal position, render invisible below trigger
  useLayoutEffect(() => {
    if (!visible || !triggerRef.current) { setPos(null); return }
    const rect = triggerRef.current.getBoundingClientRect()
    const rawLeft = rect.left + rect.width / 2
    const clampedLeft = Math.max(
      PADDING + TOOLTIP_WIDTH / 2,
      Math.min(rawLeft, window.innerWidth - PADDING - TOOLTIP_WIDTH / 2)
    )
    setPos({ top: rect.bottom + 4, left: clampedLeft, above: false, ready: false })
  }, [visible])

  // Pass 2: after tooltip renders, measure actual height and decide above/below
  useLayoutEffect(() => {
    if (!pos || pos.ready || !triggerRef.current || !tooltipRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const tooltipHeight = tooltipRef.current.offsetHeight
    const spaceBelow = window.innerHeight - rect.bottom - 4
    const above = spaceBelow < tooltipHeight + 4
    const top = above ? rect.top - tooltipHeight - 4 : rect.bottom + 4
    setPos(p => p ? { ...p, top, above, ready: true } : null)
  }, [pos])

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
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            transform: "translateX(-50%)",
            width: TOOLTIP_WIDTH,
            visibility: pos.ready ? "visible" : "hidden",
          }}
          className="rounded-lg bg-[#111110] px-3 py-2.5 text-[11px] font-normal normal-case tracking-normal text-white shadow-lg z-[9999] text-left leading-relaxed whitespace-pre-line"
        >
          {text}
        </div>,
        document.body
      )}
    </>
  )
}
