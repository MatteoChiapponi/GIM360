/**
 * Recargo por mora: la parte que comparten el backend y las vistas.
 *
 * Mismo criterio que `lib/payment-methods.ts` — vive en `lib/` y no importa el
 * cliente de Prisma, porque de acá lee cualquier componente "use client". La
 * fórmula está una sola vez: el servicio delega en estas funciones, así que lo
 * que la pantalla previsualiza es exactamente lo que después cobra el backend.
 *
 * Los valores duplican los enums `LateFeeType` y `LateFeeFrequency` de Prisma;
 * el servicio tiene un chequeo de tipos que deja de compilar si se separan.
 */

import { formatMoney } from "./payment-methods"

export type LateFeeTypeValue = "FIXED" | "PERCENT"
export type LateFeeFrequencyValue = "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY"

export type LateFeeConfig = {
  /** Con la regla apagada el recargo siempre es 0, cualquiera sea el atraso. */
  enabled: boolean
  /** Días de tolerancia después del vencimiento antes de que empiece a correr. */
  graceDays: number
  feeType: LateFeeTypeValue
  /** Pesos si `feeType` es FIXED, porcentaje de la cuota si es PERCENT. */
  feeValue: number
  frequency: LateFeeFrequencyValue
  /** Tope del recargo acumulado, en pesos. `null` = sin tope. */
  maxFeeAmount: number | null
}

/** Regla apagada: el default de un gimnasio que nunca la configuró. */
export const DEFAULT_LATE_FEE_CONFIG: LateFeeConfig = {
  enabled: false,
  graceDays: 0,
  feeType: "PERCENT",
  feeValue: 0,
  frequency: "ONCE",
  maxFeeAmount: null,
}

export const LATE_FEE_FREQUENCY_LABEL: Record<LateFeeFrequencyValue, string> = {
  ONCE: "Una sola vez",
  DAILY: "Por cada día de atraso",
  WEEKLY: "Por cada semana de atraso",
  MONTHLY: "Por cada mes de atraso",
}

/** Días que cubre cada aplicación del recargo. `ONCE` no acumula. */
const FREQUENCY_DAYS: Record<Exclude<LateFeeFrequencyValue, "ONCE">, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
}

const round2 = (n: number) => Math.round(n * 100) / 100

const MS_PER_DAY = 86_400_000

/** "YYYY-MM" de un período guardado como Date (primer día del mes en UTC). */
export function periodKey(period: string | Date): string {
  if (typeof period === "string") return period
  return `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}`
}

/**
 * Fecha de vencimiento de una cuota: el `dueDay` del alumno dentro del mes del
 * período, recortado al último día si el mes es más corto (un dueDay 31 vence
 * el 28 de febrero). Devuelve la medianoche local de ese día.
 */
export function dueDateFor(period: string | Date, dueDay: number): Date {
  const [year, month] = periodKey(period).split("-").map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(dueDay, lastDay))
}

/**
 * Días de atraso a una fecha dada. El alumno tiene todo el día del vencimiento
 * para pagar: al día siguiente debe 1 día. Nunca es negativo.
 */
export function lateDaysAt(period: string | Date, dueDay: number, at: Date = new Date()): number {
  const deadline = dueDateFor(period, dueDay)
  deadline.setHours(23, 59, 59, 999)
  if (at.getTime() <= deadline.getTime()) return 0
  return Math.floor((at.getTime() - deadline.getTime()) / MS_PER_DAY) + 1
}

/**
 * Cuántas veces se aplicó el recargo con ese atraso. 0 mientras la mora esté
 * dentro de la tolerancia; después, 1 para `ONCE` y un múltiplo para el resto
 * (una semana y un día de atraso ya son dos aplicaciones semanales).
 */
export function lateFeeCharges(lateDays: number, config: Pick<LateFeeConfig, "graceDays" | "frequency">): number {
  const effective = lateDays - config.graceDays
  if (effective <= 0) return 0
  if (config.frequency === "ONCE") return 1
  return Math.ceil(effective / FREQUENCY_DAYS[config.frequency])
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

/** "10% por cada semana de atraso, a partir del día 5" — resumen de la regla. */
export function lateFeeSummary(config: LateFeeConfig): string | null {
  if (!config.enabled || config.feeValue <= 0) return null

  const monto = config.feeType === "PERCENT" ? `${config.feeValue}% de la cuota` : formatMoney(config.feeValue)
  const cada =
    config.frequency === "ONCE"
      ? "por única vez"
      : LATE_FEE_FREQUENCY_LABEL[config.frequency].toLowerCase()
  const desde =
    config.graceDays === 0
      ? "desde el día siguiente al vencimiento"
      : `a partir de ${config.graceDays} día${config.graceDays === 1 ? "" : "s"} de atraso`
  const tope = config.maxFeeAmount !== null ? `, con un tope de ${formatMoney(config.maxFeeAmount)}` : ""

  return `${monto} ${cada}, ${desde}${tope}`
}

/** "3 días" / "1 día" — para textos de atraso. */
export function daysLabel(days: number): string {
  return days === 1 ? "1 día" : `${days} días`
}
