/**
 * Los períodos mensuales se guardan como el primer día del mes en UTC
 * (`Payment.period`, vigencias de `StudentDiscount`) y viajan por la API como
 * "YYYY-MM". Estos helpers son el único lugar donde se traduce entre los dos.
 */

/** "YYYY-MM" → primer día de ese mes (UTC). */
export function parsePeriod(period: string): Date {
  const [year, month] = period.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

/** Primer día del mes en curso (UTC). */
export function currentPeriod(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
