"use client"

import { useEffect, useState } from "react"
import { useFetch } from "@/hooks/useFetch"
import { Button } from "@/components/ui/Button"
import { NumberInput } from "@/components/ui/NumberInput"
import { Select } from "@/components/ui/Select"
import { Skeleton } from "@/components/ui/Skeleton"
import { formatMoney } from "@/lib/payment-methods"
import {
  DEFAULT_LATE_FEE_CONFIG,
  LATE_FEE_FREQUENCY_LABEL,
  computeLateFee,
  daysLabel,
  lateFeeCharges,
  type LateFeeConfig,
  type LateFeeFrequencyValue,
  type LateFeeTypeValue,
} from "@/lib/late-fee"

/** Cuota y atraso de referencia para mostrar cómo queda la regla. */
const SAMPLE_AMOUNT = 10000
const DEFAULT_SAMPLE_DAYS = "15"

const TYPE_OPTIONS: { value: LateFeeTypeValue; label: string }[] = [
  { value: "PERCENT", label: "Porcentaje de la cuota" },
  { value: "FIXED", label: "Monto fijo" },
]

const FREQUENCIES: LateFeeFrequencyValue[] = ["ONCE", "DAILY", "WEEKLY", "MONTHLY"]

/** Formulario: los números se editan como texto para permitir el campo vacío. */
type Draft = {
  enabled: boolean
  graceDays: string
  feeType: LateFeeTypeValue
  feeValue: string
  frequency: LateFeeFrequencyValue
  capped: boolean
  maxFeeAmount: string
}

const toDraft = (c: LateFeeConfig): Draft => ({
  enabled: c.enabled,
  graceDays: String(c.graceDays),
  feeType: c.feeType,
  feeValue: String(c.feeValue),
  frequency: c.frequency,
  capped: c.maxFeeAmount !== null,
  maxFeeAmount: c.maxFeeAmount === null ? "" : String(c.maxFeeAmount),
})

const toConfig = (d: Draft): LateFeeConfig => ({
  enabled: d.enabled,
  graceDays: Number(d.graceDays) || 0,
  feeType: d.feeType,
  feeValue: Number(d.feeValue) || 0,
  frequency: d.frequency,
  maxFeeAmount: d.capped && d.maxFeeAmount !== "" ? Number(d.maxFeeAmount) : null,
})

const sameConfig = (a: LateFeeConfig, b: LateFeeConfig) =>
  a.enabled === b.enabled &&
  a.graceDays === b.graceDays &&
  a.feeType === b.feeType &&
  a.feeValue === b.feeValue &&
  a.frequency === b.frequency &&
  a.maxFeeAmount === b.maxFeeAmount

/** Sección de configuración: el recargo que acumula una cuota impaga. */
export function LateFeeSettings({ gymId }: { gymId: string }) {
  const { data: config, loading, error, refetch } = useFetch<LateFeeConfig>(
    `/api/late-fee?gymId=${gymId}`,
    DEFAULT_LATE_FEE_CONFIG,
    "No se pudo cargar el recargo por mora.",
  )

  const [draft, setDraft] = useState<Draft | null>(null)
  const [sampleDays, setSampleDays] = useState(DEFAULT_SAMPLE_DAYS)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Igual que en medios de pago: solo sincroniza el formulario con lo guardado.
    // No toca `saved`, que se apagaría con el refetch que dispara el propio guardado.
    setDraft(toDraft(config))
  }, [config])

  function update(patch: Partial<Draft>) {
    setSaved(false)
    setSaveError(null)
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
  }

  if (loading && !draft) {
    return <Skeleton className="h-64 w-full rounded-xl" />
  }
  if (!draft) return null

  const preview = toConfig(draft)
  const days = Number(sampleDays) || 0
  const fee = computeLateFee(SAMPLE_AMOUNT, days, preview)
  const charges = lateFeeCharges(days, preview)
  const dirty = !sameConfig(preview, config)

  async function handleSave() {
    if (!draft) return
    setSaveError(null)
    setSaved(false)

    const body = toConfig(draft)

    // Mismo criterio que el schema del backend, para no mostrar un error genérico
    if (body.enabled) {
      if (!(body.feeValue > 0)) {
        setSaveError("El recargo tiene que ser mayor a 0.")
        return
      }
      if (body.feeType === "PERCENT" && body.feeValue > 100) {
        setSaveError("El porcentaje no puede superar el 100%.")
        return
      }
      if (draft.capped && !(Number(draft.maxFeeAmount) > 0)) {
        setSaveError("El tope tiene que ser mayor a 0, o destildá el límite.")
        return
      }
    }

    setSaving(true)
    try {
      const res = await fetch("/api/late-fee", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gymId, ...body }),
      })
      if (res.ok) {
        setSaved(true)
        await refetch()
      } else {
        const data = await res.json().catch(() => ({}))
        setSaveError(typeof data?.error === "string" ? data.error : "No se pudo guardar el recargo por mora.")
      }
    } catch {
      setSaveError("Error de conexión. Intentá de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#111110]">Recargo por mora</h2>
          <p className="mt-0.5 text-sm text-[#68685F]">
            Pasado el vencimiento, la cuota impaga acumula un recargo. Se calcula al registrar el
            pago, con los días de atraso de ese momento, y se puede condonar cuota por cuota.
          </p>
        </div>
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Guardando…" : "Guardar mora"}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
      )}

      <div
        className={`rounded-xl border bg-white p-4 sm:p-5 transition-colors ${
          draft.enabled ? "border-[#E5E4E0]" : "border-[#F0EFEB] bg-[#FAFAF9]"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-[15px] font-semibold ${draft.enabled ? "text-[#111110]" : "text-[#A5A49D]"}`}>
              Cobrar recargo por pago fuera de término
            </p>
            <p className="text-sm text-[#A5A49D]">
              {draft.enabled
                ? "Se aplica automáticamente al cobrar una cuota vencida"
                : "Las cuotas vencidas se cobran al monto original"}
            </p>
          </div>

          <label className="flex items-center gap-2 shrink-0 cursor-pointer">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={draft.enabled}
              aria-label="Cobrar recargo por mora"
              onChange={(e) => update({ enabled: e.target.checked })}
            />
            <span className="relative h-6 w-11 rounded-full bg-[#E5E4E0] transition-colors peer-checked:bg-[#111110] after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
          </label>
        </div>

        {draft.enabled && (
          <div className="mt-4 space-y-4 border-t border-[#F0EFEB] pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-[#111110]">Cuánto</p>
                <div className="flex items-center gap-1.5">
                  <NumberInput
                    value={draft.feeValue}
                    onChange={(e) => update({ feeValue: e.target.value })}
                    placeholder={draft.feeType === "PERCENT" ? "Ej: 10" : "Ej: 500"}
                    aria-label="Monto del recargo"
                    className="w-28"
                  />
                  <span className="text-sm text-[#68685F]">{draft.feeType === "PERCENT" ? "%" : "$"}</span>
                </div>
                <Select
                  value={draft.feeType}
                  onChange={(e) => update({ feeType: e.target.value as LateFeeTypeValue })}
                  aria-label="Tipo de recargo"
                  className="w-full"
                >
                  {TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-medium text-[#111110]">Cada cuánto se aplica</p>
                <Select
                  value={draft.frequency}
                  onChange={(e) => update({ frequency: e.target.value as LateFeeFrequencyValue })}
                  aria-label="Frecuencia del recargo"
                  className="w-full"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>{LATE_FEE_FREQUENCY_LABEL[f]}</option>
                  ))}
                </Select>
                <p className="text-xs text-[#A5A49D]">
                  {draft.frequency === "ONCE"
                    ? "Un único recargo, sin importar cuánto se demore."
                    : "El recargo se suma otra vez por cada período que siga impaga."}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-medium text-[#111110]">Días de tolerancia</p>
                <NumberInput
                  integer
                  value={draft.graceDays}
                  onChange={(e) => update({ graceDays: e.target.value })}
                  placeholder="Ej: 5"
                  aria-label="Días de tolerancia"
                  className="w-28"
                />
                <p className="text-xs text-[#A5A49D]">
                  {Number(draft.graceDays) > 0
                    ? `El recargo recién corre después de ${daysLabel(Number(draft.graceDays))} de atraso.`
                    : "El recargo corre desde el día siguiente al vencimiento."}
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-medium text-[#111110]">Tope del recargo</p>
                <label className="flex items-center gap-2 text-sm text-[#68685F] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.capped}
                    onChange={(e) => update({ capped: e.target.checked, maxFeeAmount: e.target.checked ? draft.maxFeeAmount : "" })}
                    className="h-4 w-4 rounded border-[#E5E4E0] accent-[#111110]"
                  />
                  Limitar cuánto puede acumular
                </label>
                {draft.capped && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-[#68685F]">$</span>
                    <NumberInput
                      value={draft.maxFeeAmount}
                      onChange={(e) => update({ maxFeeAmount: e.target.value })}
                      placeholder="Ej: 5000"
                      aria-label="Tope del recargo"
                      className="w-32"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-[#FAFAF9] px-3 py-3 text-sm text-[#68685F] space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span>Una cuota de <span className="font-mono">{formatMoney(SAMPLE_AMOUNT)}</span> con</span>
                <NumberInput
                  integer
                  value={sampleDays}
                  onChange={(e) => setSampleDays(e.target.value)}
                  aria-label="Días de atraso del ejemplo"
                  className="w-16 py-1"
                />
                <span>días de atraso se cobra</span>
                <span className="font-mono font-semibold text-[#111110]">
                  {formatMoney(SAMPLE_AMOUNT + fee)}
                </span>
              </div>
              <p className="text-xs text-[#A5A49D]">
                {fee > 0
                  ? `${formatMoney(fee)} de recargo${charges > 1 ? ` (${charges} aplicaciones)` : ""}.`
                  : "Todavía sin recargo con ese atraso."}
              </p>
            </div>
          </div>
        )}
      </div>

      {saveError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">⚠ {saveError}</p>
      )}
      {saved && !dirty && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          Recargo por mora guardado.
        </p>
      )}
    </section>
  )
}
