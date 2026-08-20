/**
 * Zona horaria del proyecto: Argentina, siempre.
 *
 * El servidor corre en Estados Unidos y los gimnasios están en Argentina, así
 * que cualquier fecha calculada con la hora local del proceso sale corrida
 * (hasta cinco horas). Con `new Date()` alcanza para saber *cuándo* pasó algo
 * —un instante es absoluto—, pero en cuanto se pregunta *qué día* es, hay que
 * decir en qué zona: `getDate()`, `getMonth()` y `new Date(y, m, d)` responden
 * en la zona del runtime, y esa no es la del cliente.
 *
 * Este módulo es la única respuesta a esa pregunta. No importa Prisma ni nada
 * del server, así que lo usan igual los servicios y los componentes "use
 * client" — mismo criterio que `lib/money.ts` y `lib/late-fee.ts`.
 *
 * Además la zona se fuerza a nivel proceso (`instrumentation.ts` y
 * `next.config.ts` setean `process.env.TZ`), pero eso solo alcanza para el
 * backend: en el navegador manda la zona de la máquina del usuario. Por eso las
 * funciones de acá son explícitas y no dependen de la hora local del runtime.
 */

/** IANA de Buenos Aires. Argentina no tiene horario de verano desde 2009. */
export const TIMEZONE = "America/Argentina/Buenos_Aires"

/** El locale que usan todos los formatos de la UI. */
export const LOCALE = "es-AR"

/** Los días como los guarda el enum `DayOfWeek` de Prisma, indexados por `getDay()`. */
export const WEEKDAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const

export type WeekdayName = (typeof WEEKDAY_NAMES)[number]

/** Un instante partido en la hora de pared argentina. `weekday`: 0 = domingo. */
export type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: number
}

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

/** Descompone un instante en la hora de pared de Buenos Aires. */
export function argentinaParts(at: Date = new Date()): DateParts {
  if (Number.isNaN(at.getTime())) {
    throw new RangeError("argentinaParts recibió una fecha inválida")
  }

  const parts: Record<string, string> = {}
  for (const p of partsFormatter.formatToParts(at)) parts[p.type] = p.value

  const year = Number(parts.year)
  const month = Number(parts.month)
  const day = Number(parts.day)

  return {
    year,
    month,
    day,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    // El día de la semana sale de la fecha, no de un nombre localizado: parsear
    // el string del formatter dependía de cómo lo escriba el ICU de turno, y un
    // fallback silencioso ahí significa mostrar los horarios del día equivocado.
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  }
}

/** Diferencia entre la hora de pared argentina y UTC, en ms, para ese instante. */
function offsetMs(at: Date): number {
  const p = argentinaParts(at)
  return (
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, at.getUTCMilliseconds()) -
    at.getTime()
  )
}

/**
 * El instante real que corresponde a una hora de pared argentina.
 *
 * Es el reemplazo de `new Date(year, month - 1, day)`, que arma la fecha en la
 * zona del runtime. `month` va de 1 a 12, como se lee, no como lo pide `Date`.
 */
export function argentinaDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute, second, ms)
  // Dos pasadas: la primera estima el offset con la fecha aproximada, la
  // segunda lo corrige si ese offset cambiaba justo ahí. Con Argentina, que no
  // mueve el reloj, la segunda siempre confirma la primera.
  let ts = wall
  ts = wall - offsetMs(new Date(ts))
  ts = wall - offsetMs(new Date(ts))
  return new Date(ts)
}

/** "YYYY-MM-DD" del día argentino de ese instante. */
export function toISODate(at: Date = new Date()): string {
  const { year, month, day } = argentinaParts(at)
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/** El día de hoy en Argentina, como "YYYY-MM-DD". */
export function todayISO(): string {
  return toISODate()
}

/** "YYYY-MM-DD" → medianoche argentina de ese día. */
export function fromISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number)
  return argentinaDate(year, month, day)
}

/** "YYYY-MM" del mes argentino de ese instante. */
export function toPeriod(at: Date = new Date()): string {
  const { year, month } = argentinaParts(at)
  return `${year}-${String(month).padStart(2, "0")}`
}

/** El mes en curso en Argentina, como "YYYY-MM". */
export function currentPeriod(): string {
  return toPeriod()
}

/** Medianoche argentina del día de ese instante. */
export function startOfDay(at: Date = new Date()): Date {
  const { year, month, day } = argentinaParts(at)
  return argentinaDate(year, month, day)
}

/** 23:59:59.999 argentinas del día de ese instante. */
export function endOfDay(at: Date = new Date()): Date {
  const { year, month, day } = argentinaParts(at)
  return argentinaDate(year, month, day, 23, 59, 59, 999)
}

/** Día de la semana en Argentina: 0 = domingo, como `getDay()`. */
export function weekday(at: Date = new Date()): number {
  return argentinaParts(at).weekday
}

/** Día de la semana en Argentina con el nombre del enum `DayOfWeek`. */
export function weekdayName(at: Date = new Date()): WeekdayName {
  return WEEKDAY_NAMES[weekday(at)]
}

/** El mismo día argentino, corrido `days` días (puede ser negativo). */
export function addDays(at: Date, days: number): Date {
  const p = argentinaParts(at)
  return argentinaDate(p.year, p.month, p.day + days, p.hour, p.minute, p.second)
}

/** Cantidad de días del mes (`month` de 1 a 12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** true si los dos instantes caen el mismo día argentino. */
export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b)
}

/**
 * ISO 8601 con el offset de Argentina: "2026-08-20T14:32:11.123-03:00".
 *
 * Sigue siendo un instante sin ambigüedad —lo parsea cualquier cosa que lea
 * ISO— pero se lee en la hora del gimnasio, que es lo que uno quiere cuando
 * cruza un log con lo que dice el cliente que pasó.
 */
export function toArgentinaISOString(at: Date = new Date()): string {
  const p = argentinaParts(at)
  const offset = offsetMs(at) / 60_000
  const sign = offset < 0 ? "-" : "+"
  const abs = Math.abs(offset)
  const pad = (n: number, len = 2) => String(n).padStart(len, "0")

  return (
    `${p.year}-${pad(p.month)}-${pad(p.day)}` +
    `T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}.${pad(at.getMilliseconds(), 3)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  )
}

// ── Formato ────────────────────────────────────────────────────────────────
// Todos fuerzan `timeZone`: sin eso, `toLocaleDateString` usa la zona del
// navegador o la del servidor y una fecha guardada a las 22 h muestra el día
// anterior.

function accepts(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value)
}

/** "20/08/2026" */
export function formatDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return accepts(value).toLocaleDateString(LOCALE, { timeZone: TIMEZONE, ...options })
}

/** "20/08/2026, 14:32" */
export function formatDateTime(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return accepts(value).toLocaleString(LOCALE, {
    timeZone: TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
    ...options,
  })
}

/** "14:32" */
export function formatTime(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = {},
): string {
  return accepts(value).toLocaleTimeString(LOCALE, {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  })
}

/** "agosto de 2026" — recibe "YYYY-MM" o una fecha. */
export function formatMonthYear(value: string | Date): string {
  const period = typeof value === "string" ? value : toPeriod(value)
  const [year, month] = period.split("-").map(Number)
  return formatDate(argentinaDate(year, month, 1), { month: "long", year: "numeric" })
}
