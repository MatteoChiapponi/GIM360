import { Button } from "./Button"

interface InlineFormProps {
  title: string
  error?: string | null
  onSubmit: (e: React.FormEvent) => void
  submitting: boolean
  onCancel: () => void
  gridCols?: string
  children: React.ReactNode
}

export function InlineForm({
  title,
  error,
  onSubmit,
  submitting,
  onCancel,
  gridCols = "sm:grid-cols-2",
  children,
}: InlineFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-[#E5E4E0] bg-white px-5 py-5 space-y-4"
    >
      <p className="text-sm font-semibold text-[#111110]">{title}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className={`grid grid-cols-1 gap-4 ${gridCols}`}>
        {children}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando\u2026" : "Guardar"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
