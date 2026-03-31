import type { ReactNode } from "react"
import { Button } from "./Button"

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  confirmVariant?: "primary" | "danger"
  onConfirm: () => void
  onCancel: () => void
  panelClassName?: string
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
  panelClassName,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
      />

      {/* Panel */}
      <div className={`relative w-full max-w-sm rounded-2xl border border-[#E5E4E0] bg-white px-6 py-6 shadow-xl space-y-4 ${panelClassName ?? ""}`}>
        <div className="space-y-1.5">
          <p className="text-[15px] font-semibold text-[#111110]">{title}</p>
          <div className="text-sm text-[#68685F] leading-relaxed">{message}</div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant={confirmVariant} className="px-3 py-2 text-sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
