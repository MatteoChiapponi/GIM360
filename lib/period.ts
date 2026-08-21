/**
 * Los períodos mensuales se guardan como el primer día del mes en UTC
 * (`Payment.period`, vigencias de `StudentDiscount`) y viajan por la API como
 * "YYYY-MM". Este helper es el único lugar donde se traduce entre los dos.
 *
 * El mes en curso no vive acá: lo define `currentPeriod()` de `lib/timezone`,
 * que responde en hora argentina. Con la del servidor, el 1° de cada mes a la
 * mañana temprano el gimnasio todavía estaría en el mes anterior.
 */

/** "YYYY-MM" → primer día de ese mes (UTC). */
export function parsePeriod(period: string): Date {
  const [year, month] = period.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}
