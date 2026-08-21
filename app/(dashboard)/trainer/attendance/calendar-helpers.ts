/**
 * Armado del calendario de asistencias.
 *
 * Todas las fechas de acá son marcadores de día, y el día es el argentino: cada
 * `Date` es la medianoche de Buenos Aires y se lee con los helpers de
 * `lib/timezone`, nunca con `getDate()` / `getMonth()` / `getDay()`, que
 * responden en la zona del navegador. Sin eso, un entrenador con la máquina en
 * otra zona ve la grilla corrida un día y marca asistencia en la fecha
 * equivocada.
 */

import {
  addDays,
  argentinaDate,
  argentinaParts,
  daysInMonth,
  fromISODate,
  toISODate,
  weekday,
  WEEKDAY_NAMES,
} from "@/lib/timezone"

// ─── Constants ────────────────────────────────────────────────────────────────

/** Short day labels Mon→Sun (European week) */
export const DAY_LABELS_SHORT = ["L", "M", "M", "J", "V", "S", "D"] as const

export const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const

const MONTH_NAMES_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
] as const

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const

// ─── Date ↔ string ────────────────────────────────────────────────────────────

/** Día argentino → "YYYY-MM-DD" */
export function toDateStr(d: Date): string {
  return toISODate(d)
}

/** "YYYY-MM-DD" → medianoche argentina de ese día */
export function fromDateStr(s: string): Date {
  return fromISODate(s)
}

// ─── Week helpers ─────────────────────────────────────────────────────────────

/** El lunes de la semana que contiene a d, a medianoche argentina. */
export function getWeekStart(d: Date): Date {
  const { year, month, day } = argentinaParts(d)
  const dow = weekday(d) // 0 = domingo
  const diff = dow === 0 ? -6 : 1 - dow
  return argentinaDate(year, month, day + diff)
}

/** El domingo que cierra la semana que arranca en weekStart. */
export function getWeekEnd(weekStart: Date): Date {
  return addDays(weekStart, 6)
}

/** Los 7 días [Lun … Dom] desde weekStart. */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

// ─── Month helpers ────────────────────────────────────────────────────────────

/** El mes argentino al que pertenece d, como [año, mes 0-indexado]. */
export function getYearMonth(d: Date): [number, number] {
  const { year, month } = argentinaParts(d)
  return [year, month - 1]
}

/** El día 1 del mes argentino al que pertenece d, corrido `months` meses. */
export function getMonthStart(d: Date, months = 0): Date {
  const { year, month } = argentinaParts(d)
  return argentinaDate(year, month + months, 1)
}


/**
 * Celdas de la grilla mensual (columnas Lun–Dom), con el relleno de los meses
 * vecinos. Siempre 35 o 42 celdas. `month` es 0-indexado, como `getMonth()`.
 */
export function getMonthCalendarDays(
  year: number,
  month: number,
): { date: Date; isCurrentMonth: boolean }[] {
  const firstDay = argentinaDate(year, month + 1, 1)
  const lastDay = argentinaDate(year, month + 1, daysInMonth(year, month + 1))

  const gridStart = getWeekStart(firstDay)
  const gridEnd = getWeekEnd(getWeekStart(lastDay))

  const days: { date: Date; isCurrentMonth: boolean }[] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    const parts = argentinaParts(cursor)
    days.push({
      date: cursor,
      isCurrentMonth: parts.month - 1 === month && parts.year === year,
    })
    cursor = addDays(cursor, 1)
  }
  return days
}

// ─── Comparisons ─────────────────────────────────────────────────────────────

/** true si los dos caen el mismo día argentino. */
export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b)
}

/** true si a es estrictamente posterior a b, a nivel día. */
export function isAfterDay(a: Date, b: Date): boolean {
  return toDateStr(a) > toDateStr(b)
}

// ─── Schedule helpers ─────────────────────────────────────────────────────────

type ScheduleInfo = { weekDays: string[]; startTime: string; endTime: string }

/** "HH:MM – HH:MM" del horario activo ese día, o "". */
export function getScheduleTimeForDay(schedules: ScheduleInfo[], date: Date): string {
  const dow = WEEKDAY_NAMES[weekday(date)]
  const match = schedules.find((s) => s.weekDays.includes(dow))
  return match ? `${match.startTime} – ${match.endTime}` : ""
}

// ─── Display formatting ───────────────────────────────────────────────────────

/** "Lun 24 Mar" */
export function formatDayLabel(d: Date): string {
  const { month, day } = argentinaParts(d)
  return `${DAY_SHORT[weekday(d)]} ${day} ${MONTH_NAMES_SHORT[month - 1]}`
}

/** "24–30 Mar" / "24 Mar – 2 Abr" */
export function formatWeekLabel(weekStart: Date): string {
  const start = argentinaParts(weekStart)
  const end = argentinaParts(getWeekEnd(weekStart))
  if (start.month === end.month) {
    return `${start.day}–${end.day} ${MONTH_NAMES_SHORT[end.month - 1]}`
  }
  return `${start.day} ${MONTH_NAMES_SHORT[start.month - 1]} – ${end.day} ${MONTH_NAMES_SHORT[end.month - 1]}`
}

/** "Marzo 2026" — `month` 0-indexado. */
export function formatMonthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`
}
