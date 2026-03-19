import { Button } from "./Button"

interface FormModalProps {
  open: boolean
  title: string
  error?: string | null
  onSubmit: (e: React.FormEvent) => void
  submitting: boolean
  onCancel: () => void
  gridCols?: string
  children: React.ReactNode
}

export function FormModal({
  open,
  title,
  error,
  onSubmit,
  submitting,
  onCancel,
  gridCols = "sm:grid-cols-2",
  children,
}: FormModalProps) {
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
      <form
        onSubmit={onSubmit}
        className="relative w-full max-w-lg rounded-2xl border border-[#E5E4E0] bg-white px-6 py-6 shadow-xl space-y-4"
      >
        <p className="text-[15px] font-semibold text-[#111110]">{title}</p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className={`grid grid-cols-1 gap-4 ${gridCols}`}>
          {children}
        </div>
        <div className="flex items-center justify-end gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Guardando\u2026" : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  )
}
