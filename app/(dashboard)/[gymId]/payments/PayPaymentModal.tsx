"use client"

import { useState } from "react"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { PaymentMethodIcon } from "@/components/ui/PaymentMethodIcon"
import {
  PAYMENT_METHOD_LABEL as METHOD_LABEL,
  adjustmentLabel,
  type PaymentMethodConfig,
  type PaymentMethodValue as PaymentMethod,
} from "@/lib/payment-methods"
import { ruledCharge } from "@/lib/charge"
import { formatMoney, round2, signedMoney } from "@/lib/money"
import { daysLabel, lateDaysAt } from "@/lib/late-fee"
import { formatMonthYear as periodLabel } from "@/lib/timezone"
import type { Payment } from "./types"

/** Redondeos que ofrece el modal, en pesos. */
const ROUNDING_STEPS = [100, 1000] as const

/** Lo que decide quien cobra y el modal le devuelve a la vista. */
export type Charge = {
  method: PaymentMethod
  lateFeeWaived: boolean
  /** Monto cobrado, solo si se ajustó a mano; `null` deja mandar a las reglas. */
  chargedAmount: number | null
  reason: string
}

type Props = {
  payment: Payment
  /** Período que se está cobrando, "YYYY-MM". */
  period: string
  /** Medios habilitados del gimnasio, con su recargo o descuento. */
  methodConfigs: PaymentMethodConfig[]
  /** Recargo por mora que le corresponde a la cuota, se termine cobrando o no. */
  lateFee: number
  busy: boolean
  onCancel: () => void
  onConfirm: (charge: Charge) => void
}

/**
 * Modal de cobro: medio de pago, condonación de la mora y monto final.
 *
 * Se monta de cero por cada cuota, así que el estado arranca siempre limpio y no
 * puede quedar el redondeo de un alumno colgado en el cobro del siguiente.
 *
 * La cuenta que hace acá es la misma que después rehace el backend —sale toda de
 * `lib/payment-methods` y `lib/late-fee`—, así que el monto que se ve es el que
 * se cobra. Lo único que el modal decide de verdad es el ajuste manual: la
 * diferencia entre ese total y lo que quien cobra dice que se cobró.
 */
export function PayPaymentModal({ payment, period, methodConfigs, lateFee, busy, onCancel, onConfirm }: Props) {
  const enabledMethods = methodConfigs.filter((c) => c.enabled)
  const cuota = Number(payment.amount)

  /** La deuda antes del medio de pago: la cuota más la mora, si se cobra. */
  function chargeableFor(waived: boolean): number {
    return round2(cuota + (waived ? 0 : lateFee))
  }

  /**
   * Lo que dan las reglas del gimnasio con ese medio: cuota + mora + el recargo o
   * descuento del medio. Es el punto de partida del monto a cobrar, y contra esto
   * se mide el ajuste manual. La cuenta es la de `lib/charge`, la misma que rehace
   * el backend al cobrar: por eso el número que se ve acá es el que se guarda.
   */
  function ruledTotalFor(method: PaymentMethod, waived: boolean): number {
    const config = methodConfigs.find((c) => c.method === method)
    if (!config) return chargeableFor(waived)
    return ruledCharge(cuota, waived ? 0 : lateFee, config).total
  }

  // Con un solo medio habilitado no hay nada que elegir: queda listo para cobrar.
  const onlyMethod = enabledMethods.length === 1 ? enabledMethods[0].method : null

  const [method, setMethod] = useState<PaymentMethod | null>(onlyMethod)
  const [waiveLateFee, setWaiveLateFee] = useState(payment.lateFeeWaived)
  const [chargedInput, setChargedInput] = useState(
    onlyMethod ? String(ruledTotalFor(onlyMethod, payment.lateFeeWaived)) : "",
  )
  const [reason, setReason] = useState("")

  /** Elegir medio (o cambiar la condonación) reescribe el monto sugerido: el
   *  redondeo que se hizo sobre otro total ya no describe este cobro. */
  function selectMethod(next: PaymentMethod, waived = waiveLateFee) {
    setMethod(next)
    setReason("")
    setChargedInput(String(ruledTotalFor(next, waived)))
  }

  function toggleWaive(waived: boolean) {
    setWaiveLateFee(waived)
    if (method) selectMethod(method, waived)
  }

  // Lo que dan las reglas, lo que se va a cobrar y la diferencia entre las dos.
  const methodConfig = method ? methodConfigs.find((c) => c.method === method) ?? null : null
  const debt = chargeableFor(waiveLateFee)
  const ruledTotal = method ? ruledTotalFor(method, waiveLateFee) : 0
  const chargedAmount = chargedInput.trim() === "" ? NaN : Number(chargedInput)
  const chargedValid = Number.isFinite(chargedAmount) && chargedAmount >= 0
  const manualDelta = chargedValid ? round2(chargedAmount - ruledTotal) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-[#E5E4E0] bg-white px-6 py-6 shadow-xl space-y-5">
        <div className="space-y-1.5">
          <p className="text-[15px] font-semibold text-[#111110]">Registrar pago</p>
          <p className="text-sm text-[#68685F]">
            {payment.student.firstName} {payment.student.lastName} — cuota de {periodLabel(period)} por{" "}
            <span className="font-mono font-semibold">{formatMoney(Number(payment.amount))}</span>
          </p>
        </div>

        {/* La mora se suma a la cuota antes del ajuste del medio; el backend la
            recalcula al guardar, así que esto es lo que se va a cobrar. */}
        {lateFee > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 space-y-2">
            <p className="text-sm text-amber-900">
              Recargo por mora:{" "}
              <span className="font-mono font-semibold">{formatMoney(lateFee)}</span>{" "}
              <span className="text-amber-700">
                ({daysLabel(lateDaysAt(period, payment.student.dueDay))} de atraso)
              </span>
            </p>
            <label className="flex items-center gap-2 text-sm text-amber-900 cursor-pointer">
              <input
                type="checkbox"
                checked={waiveLateFee}
                onChange={(e) => toggleWaive(e.target.checked)}
                className="h-4 w-4 rounded border-amber-300 accent-[#111110]"
              />
              No cobrar el recargo esta vez
            </label>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm text-[#A5A49D]">Método de pago</p>
          <div className={`grid gap-3 ${enabledMethods.length === 1 ? "grid-cols-1" : enabledMethods.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {enabledMethods.map((config) => {
              const total = ruledTotalFor(config.method, waiveLateFee)
              const badge = adjustmentLabel(config)
              const isDiscount = config.adjustmentType === "DISCOUNT"
              const selected = method === config.method

              return (
                <button
                  key={config.method}
                  onClick={() => selectMethod(config.method)}
                  aria-pressed={selected}
                  className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-colors cursor-pointer ${
                    selected
                      ? "border-[#111110] bg-[#FAFAF9] text-[#111110]"
                      : "border-[#E5E4E0] bg-white text-[#68685F] hover:border-[#111110] hover:text-[#111110] hover:bg-[#FAFAF9]"
                  }`}
                >
                  <PaymentMethodIcon method={config.method} />
                  <span className="text-center leading-tight">{METHOD_LABEL[config.method]}</span>
                  {badge && (
                    <span className={`text-[10px] font-semibold ${isDiscount ? "text-emerald-700" : "text-amber-700"}`}>
                      {badge}
                    </span>
                  )}
                  {(badge || total !== Number(payment.amount)) && (
                    <span className="font-mono text-xs font-semibold text-[#111110]">{formatMoney(total)}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Monto a cobrar: arranca en lo que dan las reglas y se puede pisar.
            La diferencia queda registrada como ajuste, no se pierde. */}
        {method && (
          <div className="rounded-xl border border-[#E5E4E0] bg-[#FAFAF9] px-4 py-3.5 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-[#68685F]">
                <span>Cuota</span>
                <span className="font-mono">{formatMoney(Number(payment.amount))}</span>
              </div>
              {!waiveLateFee && lateFee > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Mora ({daysLabel(lateDaysAt(period, payment.student.dueDay))})</span>
                  <span className="font-mono">{signedMoney(lateFee)}</span>
                </div>
              )}
              {ruledTotal !== debt && (
                <div className="flex justify-between text-[#68685F]">
                  <span>
                    {METHOD_LABEL[method]}
                    {methodConfig && adjustmentLabel(methodConfig) ? ` ${adjustmentLabel(methodConfig)}` : ""}
                  </span>
                  <span className="font-mono">{signedMoney(round2(ruledTotal - debt))}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[#E5E4E0] pt-1 font-medium text-[#111110]">
                <span>Total según la cuota</span>
                <span className="font-mono">{formatMoney(ruledTotal)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="chargedAmount" className="block text-sm font-medium text-[#111110]">
                Monto a cobrar
              </label>
              <Input
                id="chargedAmount"
                type="number"
                min={0}
                step={0.01}
                inputMode="decimal"
                value={chargedInput}
                onChange={(e) => setChargedInput(e.target.value)}
                className="w-full font-mono"
              />
              <div className="flex flex-wrap items-center gap-2">
                {ROUNDING_STEPS.map((step) => {
                  const rounded = Math.round(ruledTotal / step) * step
                  if (rounded === ruledTotal || rounded <= 0) return null
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => setChargedInput(String(rounded))}
                      className="rounded-lg border border-[#E5E4E0] bg-white px-2.5 py-1 text-xs font-medium text-[#68685F] hover:border-[#111110] hover:text-[#111110] transition-colors cursor-pointer"
                    >
                      Redondear a {formatMoney(rounded)}
                    </button>
                  )
                })}
                {manualDelta !== 0 && (
                  <button
                    type="button"
                    onClick={() => selectMethod(method)}
                    className="text-xs font-medium text-[#68685F] underline underline-offset-2 hover:text-[#111110] transition-colors cursor-pointer"
                  >
                    Restaurar
                  </button>
                )}
              </div>
              {!chargedValid && (
                <p className="text-xs text-red-600">Ingresá un monto válido.</p>
              )}
            </div>

            {manualDelta !== 0 && (
              <div className="space-y-1.5 rounded-lg border border-[#E5E4E0] bg-white px-3 py-2.5">
                <p className="text-sm text-[#111110]">
                  Ajuste manual:{" "}
                  <span className={`font-mono font-semibold ${manualDelta > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                    {signedMoney(manualDelta)}
                  </span>
                </p>
                <Input
                  type="text"
                  maxLength={200}
                  placeholder="Motivo (opcional): redondeo, acuerdo…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full"
                />
                <p className="text-xs text-[#A5A49D]">Queda registrado en la cuota y en el cierre de caja.</p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              method &&
              onConfirm({
                method,
                lateFeeWaived: waiveLateFee,
                // El monto solo viaja si alguien lo tocó: si no, manda el backend
                chargedAmount: manualDelta === 0 ? null : round2(chargedAmount),
                reason,
              })
            }
            disabled={!method || !chargedValid || busy}
          >
            {method ? `Cobrar ${formatMoney(chargedValid ? round2(chargedAmount) : ruledTotal)}` : "Elegí un método"}
          </Button>
        </div>
      </div>
    </div>
  )
}
