/**
 * Recargo por mora: la parte que comparten el backend y las vistas.
 *
 * Mismo criterio que `lib/payment-methods.ts` — vive en `lib/` y no importa el
 * cliente de Prisma, porque de acá lee cualquier componente "use client". La
 * fórmula está una sola vez: el servicio delega en estas funciones, así que lo
 * que la pantalla previsualiza es exactamente lo que después cobra el backend.
 *
 * Los valores de `LateFeeTypeValue` duplican el enum `LateFeeType` de Prisma; el
 * servicio tiene un chequeo de tipos que deja de compilar si los dos se separan.
 */

import { round2 } from "./money"
import { argentinaDate, daysInMonth } from "./timezone"

export type LateFeeTypeValue = "FIXED" | "PERCENT"

export type LateFeeConfig = {
  /** Con la regla apagada el recargo siempre es 0, cualquiera sea el atraso. */
  enabled: boolean
  /** Días de tolerancia después del vencimiento antes de que empiece a correr. */
  graceDays: number
  feeType: LateFeeTypeValue
  /** Pesos si `feeType` es FIXED, porcentaje de la cuota si es PERCENT. */
  feeValue: number
  /**
   * Cada cuántos días se vuelve a aplicar mientras la cuota siga impaga.
   * `null` = una sola vez, no importa cuánto se demore.
   */
  repeatEveryDays: number | null
  /** Tope de veces que puede aplicarse. `null` = sin tope. */
  maxCharges: number | null
  /** Tope del recargo acumulado, en pesos. `null` = sin tope. */
  maxFeeAmount: number | null
}

/** Regla apagada: el default de un gimnasio que nunca la configuró. */
export const DEFAULT_LATE_FEE_CONFIG: LateFeeConfig = {
  enabled: false,
  graceDays: 0,
  feeType: "PERCENT",
  feeValue: 0,
  repeatEveryDays: null,
  maxCharges: null,
  maxFeeAmount: null,
}

const MS_PER_DAY = 86_400_000

/** "YYYY-MM" de un período guardado como Date (primer día del mes en UTC). */
export function periodKey(period: string | Date): string {
  if (typeof period === "string") return period
  return `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}`
}

/** El día del mes en que vence la cuota, recortado si el mes es más corto. */
function dueDayOf(period: string | Date, dueDay: number): [number, number, number] {
  const [year, month] = periodKey(period).split("-").map(Number)
  return [year, month, Math.min(dueDay, daysInMonth(year, month))]
}

/**
 * Fecha de vencimiento de una cuota: el `dueDay` del alumno dentro del mes del
 * período, recortado al último día si el mes es más corto (un dueDay 31 vence
 * el 28 de febrero). Devuelve la medianoche argentina de ese día — no la del
 * servidor, que está en Estados Unidos y adelantaría el vencimiento.
 */
export function dueDateFor(period: string | Date, dueDay: number): Date {
  const [year, month, day] = dueDayOf(period, dueDay)
  return argentinaDate(year, month, day)
}

/**
 * Días de atraso a una fecha dada. El alumno tiene todo el día del vencimiento
 * —hasta las 23:59:59 de Argentina— para pagar: al día siguiente debe 1 día.
 * Nunca es negativo.
 */
export function lateDaysAt(period: string | Date, dueDay: number, at: Date = new Date()): number {
  const [year, month, day] = dueDayOf(period, dueDay)
  const deadline = argentinaDate(year, month, day, 23, 59, 59, 999)
  if (at.getTime() <= deadline.getTime()) return 0
  return Math.floor((at.getTime() - deadline.getTime()) / MS_PER_DAY) + 1
}

/**
 * Cuántas veces se aplicó el recargo con ese atraso.
 *
 * 0 mientras la mora esté dentro de la tolerancia. Después, 1 si la regla no se
 * repite; si se repite, una aplicación por cada bloque de `repeatEveryDays`
 * empezado (con repetición cada 7 días, una semana y un día ya son dos).
 * `maxCharges` corta la cuenta.
 */
export function lateFeeCharges(
  lateDays: number,
  config: Pick<LateFeeConfig, "graceDays" | "repeatEveryDays" | "maxCharges">,
): number {
  const effective = lateDays - config.graceDays
  if (effective <= 0) return 0

  const charges = config.repeatEveryDays ? Math.ceil(effective / config.repeatEveryDays) : 1

  return config.maxCharges !== null ? Math.min(charges, config.maxCharges) : charges
}

/**
 * Recargo acumulado sobre una cuota de `baseAmount` con `lateDays` de atraso.
 * Devuelve siempre un monto positivo o 0, redondeado a dos decimales.
 */
export function computeLateFee(baseAmount: number, lateDays: number, config: LateFeeConfig): number {
  if (!config.enabled || config.feeValue <= 0) return 0

  const charges = lateFeeCharges(lateDays, config)
  if (charges === 0) return 0

  const unit = config.feeType === "PERCENT" ? (baseAmount * config.feeValue) / 100 : config.feeValue
  const fee = round2(unit * charges)

  return config.maxFeeAmount !== null ? Math.min(fee, config.maxFeeAmount) : fee
}

/** "3 días" / "1 día" — para textos de atraso. */
export function daysLabel(days: number): string {
  return days === 1 ? "1 día" : `${days} días`
}
