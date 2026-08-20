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
  computeLateFee,
  daysLabel,
  lateFeeCharges,
  type LateFeeConfig,
  type LateFeeTypeValue,
} from "@/lib/late-fee"

/** Cuota y atraso de referencia para mostrar cómo queda la regla. */
const SAMPLE_AMOUNT = 10000
const DEFAULT_SAMPLE_DAYS = "15"

const TYPE_OPTIONS: { value: LateFeeTypeValue; label: string }[] = [
  { value: "PERCENT", label: "Porcentaje de la cuota" },
  { value: "FIXED", label: "Monto fijo" },
]

/** Formulario: los números se editan como texto para permitir el campo vacío. */
type Draft = {
  enabled: boolean
  graceDays: string
  feeType: LateFeeTypeValue
  feeValue: string
  /** El recargo vuelve a aplicarse mientras la cuota siga impaga */
  repeats: boolean
  repeatEveryDays: string
  /** Tope de aplicaciones (solo tiene sentido si se repite) */
  cappedCharges: boolean
  maxCharges: string
  /** Tope del recargo acumulado, en pesos */
  cappedAmount: boolean
  maxFeeAmount: string
}

const toDraft = (c: LateFeeConfig): Draft => ({
  enabled: c.enabled,
  graceDays: String(c.graceDays),
  feeType: c.feeType,
  feeValue: String(c.feeValue),
  repeats: c.repeatEveryDays !== null,
  repeatEveryDays: c.repeatEveryDays === null ? "" : String(c.repeatEveryDays),
  cappedCharges: c.maxCharges !== null,
  maxCharges: c.maxCharges === null ? "" : String(c.maxCharges),
  cappedAmount: c.maxFeeAmount !== null,
  maxFeeAmount: c.maxFeeAmount === null ? "" : String(c.maxFeeAmount),
})

const toConfig = (d: Draft): LateFeeConfig => {
  const repeatEveryDays = d.repeats && d.repeatEveryDays !== "" ? Number(d.repeatEveryDays) : null
  return {
    enabled: d.enabled,
    graceDays: Number(d.graceDays) || 0,
    feeType: d.feeType,
    feeValue: Number(d.feeValue) || 0,
    repeatEveryDays,
    // Sin repetición el recargo se cobra una sola vez: el tope de veces no aplica.
    maxCharges: repeatEveryDays !== null && d.cappedCharges && d.maxCharges !== "" ? Number(d.maxCharges) : null,
    maxFeeAmount: d.cappedAmount && d.maxFeeAmount !== "" ? Number(d.maxFeeAmount) : null,
  }
}

const sameConfig = (a: LateFeeConfig, b: LateFeeConfig) =>
  a.enabled === b.enabled &&
  a.graceDays === b.graceDays &&
  a.feeType === b.feeType &&
  a.feeValue === b.feeValue &&
  a.repeatEveryDays === b.repeatEveryDays &&
  a.maxCharges === b.maxCharges &&
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
      if (draft.repeats && !(Number(draft.repeatEveryDays) >= 1)) {
        setSaveError("Ingresá cada cuántos días se repite el recargo, o destildá la repetición.")
        return
      }
      if (draft.repeats && draft.cappedCharges && !(Number(draft.maxCharges) >= 1)) {
        setSaveError("El máximo de veces tiene que ser 1 o más, o destildá ese límite.")
        return
      }
      if (draft.cappedAmount && !(Number(draft.maxFeeAmount) > 0)) {
        setSaveError("El tope en pesos tiene que ser mayor a 0, o destildá ese límite.")
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
                <label className="flex items-center gap-2 text-sm text-[#68685F] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.repeats}
                    onChange={(e) =>
                      update({
                        repeats: e.target.checked,
                        repeatEveryDays: e.target.checked ? draft.repeatEveryDays : "",
                        // El tope de veces solo existe si el recargo se repite
                        cappedCharges: e.target.checked ? draft.cappedCharges : false,
                        maxCharges: e.target.checked ? draft.maxCharges : "",
                      })
                    }
                    className="h-4 w-4 rounded border-[#E5E4E0] accent-[#111110]"
                  />
                  Repetirlo mientras siga impaga
                </label>
                {draft.repeats ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-[#68685F]">cada</span>
                    <NumberInput
                      integer
                      value={draft.repeatEveryDays}
                      onChange={(e) => update({ repeatEveryDays: e.target.value })}
                      placeholder="Ej: 7"
                      aria-label="Cada cuántos días se repite el recargo"
                      className="w-20"
                    />
                    <span className="text-sm text-[#68685F]">días</span>
                  </div>
                ) : (
                  <p className="text-xs text-[#A5A49D]">
                    Un único recargo, sin importar cuánto se demore en pagar.
                  </p>
                )}
                {draft.repeats && (
                  <>
                    <label className="flex items-center gap-2 pt-1 text-sm text-[#68685F] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={draft.cappedCharges}
                        onChange={(e) => update({ cappedCharges: e.target.checked, maxCharges: e.target.checked ? draft.maxCharges : "" })}
                        className="h-4 w-4 rounded border-[#E5E4E0] accent-[#111110]"
                      />
                      Limitar cuántas veces se cobra
                    </label>
                    {draft.cappedCharges && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-[#68685F]">máximo</span>
                        <NumberInput
                          integer
                          value={draft.maxCharges}
                          onChange={(e) => update({ maxCharges: e.target.value })}
                          placeholder="Ej: 4"
                          aria-label="Máximo de veces que se cobra el recargo"
                          className="w-20"
                        />
                        <span className="text-sm text-[#68685F]">veces</span>
                      </div>
                    )}
                  </>
                )}
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
                <p className="text-sm font-medium text-[#111110]">Tope en pesos</p>
                <label className="flex items-center gap-2 text-sm text-[#68685F] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.cappedAmount}
                    onChange={(e) => update({ cappedAmount: e.target.checked, maxFeeAmount: e.target.checked ? draft.maxFeeAmount : "" })}
                    className="h-4 w-4 rounded border-[#E5E4E0] accent-[#111110]"
                  />
                  Limitar cuánto puede acumular
                </label>
                {draft.cappedAmount && (
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
