"use client"

import { useEffect, useState } from "react"
import { useFetch } from "@/hooks/useFetch"
import { Button } from "@/components/ui/Button"
import { NumberInput } from "@/components/ui/NumberInput"
import { PageHeader } from "@/components/ui/PageHeader"
import { Skeleton } from "@/components/ui/Skeleton"
import { PaymentMethodIcon } from "@/components/ui/PaymentMethodIcon"
import {
  PAYMENT_METHOD_VALUES,
  PAYMENT_METHOD_LABEL,
  adjustedAmount,
  defaultPaymentMethodConfig,
  formatMoney,
  methodAdjustment,
  type AdjustmentType,
  type PaymentMethodConfig,
  type PaymentMethodValue,
} from "@/lib/payment-methods"

/** Cuota de referencia para mostrar cómo queda el monto con cada ajuste. */
const SAMPLE_AMOUNT = 10000

const ADJUSTMENT_OPTIONS: { value: AdjustmentType; label: string }[] = [
  { value: "NONE", label: "Sin ajuste" },
  { value: "SURCHARGE", label: "Recargo" },
  { value: "DISCOUNT", label: "Descuento" },
]

const METHOD_HINT: Record<PaymentMethodValue, string> = {
  CASH: "Cobro en el mostrador",
  TRANSFER: "Transferencia bancaria o billetera virtual",
  CARD: "Débito o crédito",
}

/** Fila del formulario: el porcentaje se edita como texto para permitir el campo vacío. */
type Draft = Omit<PaymentMethodConfig, "adjustmentPercent"> & { adjustmentPercent: string }

const toDraft = (c: PaymentMethodConfig): Draft => ({ ...c, adjustmentPercent: String(c.adjustmentPercent) })

const draftConfig = (d: Draft) => ({
  adjustmentType: d.adjustmentType,
  adjustmentPercent: Number(d.adjustmentPercent) || 0,
})

export default function SettingsView({ gymId }: { gymId: string }) {
  const { data: configs, loading, error, refetch } = useFetch<PaymentMethodConfig[]>(
    `/api/payment-methods?gymId=${gymId}`,
    PAYMENT_METHOD_VALUES.map(defaultPaymentMethodConfig),
    "No se pudo cargar la configuración de medios de pago.",
  )

  const [drafts, setDrafts] = useState<Draft[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setDrafts(configs.map(toDraft))
    setSaveError(null)
    setSaved(false)
  }, [configs])

  const dirty = drafts.some((d, i) => {
    const original = configs[i]
    if (!original) return false
    return (
      d.enabled !== original.enabled ||
      d.adjustmentType !== original.adjustmentType ||
      (Number(d.adjustmentPercent) || 0) !== original.adjustmentPercent
    )
  })

  const enabledCount = drafts.filter((d) => d.enabled).length

  function update(method: PaymentMethodValue, patch: Partial<Draft>) {
    setSaved(false)
    setSaveError(null)
    setDrafts((prev) => prev.map((d) => (d.method === method ? { ...d, ...patch } : d)))
  }

  function changeType(method: PaymentMethodValue, adjustmentType: AdjustmentType) {
    // "Sin ajuste" no lleva porcentaje; al elegir recargo/descuento arranca vacío.
    update(method, { adjustmentType, adjustmentPercent: adjustmentType === "NONE" ? "0" : "" })
  }

  async function handleSave() {
    setSaveError(null)
    setSaved(false)

    if (enabledCount === 0) {
      setSaveError("Tiene que quedar al menos un medio de pago habilitado.")
      return
    }

    const invalid = drafts.find((d) => {
      if (d.adjustmentType === "NONE") return false
      const pct = Number(d.adjustmentPercent)
      return !d.adjustmentPercent || Number.isNaN(pct) || pct <= 0 || pct > 100
    })
    if (invalid) {
      setSaveError(`El porcentaje de ${PAYMENT_METHOD_LABEL[invalid.method]} tiene que ser un número entre 0,01 y 100.`)
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/payment-methods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId,
          configs: drafts.map((d) => ({
            method: d.method,
            enabled: d.enabled,
            adjustmentType: d.adjustmentType,
            adjustmentPercent: d.adjustmentType === "NONE" ? 0 : Number(d.adjustmentPercent),
          })),
        }),
      })
      if (res.ok) {
        setSaved(true)
        await refetch()
      } else {
        const data = await res.json().catch(() => ({}))
        setSaveError(typeof data?.error === "string" ? data.error : "No se pudo guardar la configuración.")
      }
    } catch {
      setSaveError("Error de conexión. Intentá de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        subtitle="Medios de pago que acepta el gimnasio"
        action={
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        }
      />

      <div className="rounded-xl border border-[#E5E4E0] bg-white p-4 text-sm text-[#68685F]">
        Solo los medios habilitados aparecen al registrar el pago de una cuota. Si le cargás un
        recargo o un descuento, el monto de la cuota se ajusta automáticamente al cobrar con ese medio.
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p>
      )}

      {loading && drafts.length === 0 ? (
        <div className="space-y-3">
          {PAYMENT_METHOD_VALUES.map((m) => (
            <Skeleton key={m} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((d) => {
            const config = draftConfig(d)
            const delta = methodAdjustment(SAMPLE_AMOUNT, config)
            const final = adjustedAmount(SAMPLE_AMOUNT, config)
            const lastEnabled = d.enabled && enabledCount === 1

            return (
              <div
                key={d.method}
                className={`rounded-xl border bg-white p-4 sm:p-5 transition-colors ${
                  d.enabled ? "border-[#E5E4E0]" : "border-[#F0EFEB] bg-[#FAFAF9]"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={d.enabled ? "text-[#111110]" : "text-[#D5D4D0]"}>
                      <PaymentMethodIcon method={d.method} />
                    </span>
                    <div className="min-w-0">
                      <p className={`text-[15px] font-semibold ${d.enabled ? "text-[#111110]" : "text-[#A5A49D]"}`}>
                        {PAYMENT_METHOD_LABEL[d.method]}
                      </p>
                      <p className="text-sm text-[#A5A49D]">
                        {d.enabled ? METHOD_HINT[d.method] : "No se ofrece al registrar un pago"}
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                    <span className="text-xs font-medium text-[#68685F] hidden sm:inline">
                      {d.enabled ? "Habilitado" : "Deshabilitado"}
                    </span>
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={d.enabled}
                      disabled={lastEnabled}
                      aria-label={`Habilitar ${PAYMENT_METHOD_LABEL[d.method]}`}
                      onChange={(e) => update(d.method, { enabled: e.target.checked })}
                    />
                    <span
                      title={lastEnabled ? "Tiene que quedar al menos un medio habilitado" : undefined}
                      className="relative h-6 w-11 rounded-full bg-[#E5E4E0] transition-colors peer-checked:bg-[#111110] peer-disabled:opacity-50 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5"
                    />
                  </label>
                </div>

                {d.enabled && (
                  <div className="mt-4 space-y-3 border-t border-[#F0EFEB] pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex rounded-lg border border-[#E5E4E0] p-0.5">
                        {ADJUSTMENT_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => changeType(d.method, opt.value)}
                            className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                              d.adjustmentType === opt.value
                                ? "bg-[#111110] text-white"
                                : "text-[#68685F] hover:text-[#111110] hover:bg-[#F0EFEB]"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {d.adjustmentType !== "NONE" && (
                        <div className="flex items-center gap-1.5">
                          <NumberInput
                            value={d.adjustmentPercent}
                            onChange={(e) => update(d.method, { adjustmentPercent: e.target.value })}
                            placeholder="Ej: 10"
                            aria-label={`Porcentaje de ${PAYMENT_METHOD_LABEL[d.method]}`}
                            className="w-24"
                          />
                          <span className="text-sm text-[#68685F]">%</span>
                        </div>
                      )}
                    </div>

                    <p className="text-sm text-[#68685F]">
                      Ejemplo: una cuota de{" "}
                      <span className="font-mono">{formatMoney(SAMPLE_AMOUNT)}</span> se cobra{" "}
                      <span className="font-mono font-semibold text-[#111110]">{formatMoney(final)}</span>
                      {delta !== 0 && (
                        <span className={delta > 0 ? "text-amber-700" : "text-emerald-700"}>
                          {" "}({delta > 0 ? "+" : "−"}
                          {formatMoney(Math.abs(delta))})
                        </span>
                      )}
                      .
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {saveError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">⚠ {saveError}</p>
      )}
      {saved && !dirty && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          Configuración guardada.
        </p>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!dirty || saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  )
}
