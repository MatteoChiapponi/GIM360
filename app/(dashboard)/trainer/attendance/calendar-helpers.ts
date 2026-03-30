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

// JS getDay() → DayOfWeek enum values used in the DB
const JS_DAY_TO_ENUM = [
  "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY",
] as const

// ─── Date ↔ string ────────────────────────────────────────────────────────────

/** Local date → "YYYY-MM-DD" */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** "YYYY-MM-DD" → local midnight Date */
export function fromDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

// ─── Week helpers ─────────────────────────────────────────────────────────────

/** Returns the Monday of the week containing d (local time). */
export function getWeekStart(d: Date): Date {
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day
  const result = new Date(d)
  result.setDate(d.getDate() + diff)
  result.setHours(0, 0, 0, 0)
  return result
}

/** Returns the Sunday that ends the week starting on weekStart. */
export function getWeekEnd(weekStart: Date): Date {
  const result = new Date(weekStart)
  result.setDate(weekStart.getDate() + 6)
  return result
}

/** Returns 7 dates [Mon, Tue, Wed, Thu, Fri, Sat, Sun] starting from weekStart. */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
}

// ─── Month helpers ────────────────────────────────────────────────────────────

/**
 * Returns all cells for a month calendar grid (Mon–Sun columns).
 * Includes padding days from adjacent months. Always 35 or 42 cells.
 */
export function getMonthCalendarDays(
  year: number,
  month: number,
): { date: Date; isCurrentMonth: boolean }[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const gridStart = getWeekStart(firstDay)
  const gridEnd = getWeekEnd(getWeekStart(lastDay))

  const days: { date: Date; isCurrentMonth: boolean }[] = []
  const cursor = new Date(gridStart)
  while (cursor <= gridEnd) {
    days.push({
      date: new Date(cursor),
      isCurrentMonth: cursor.getMonth() === month && cursor.getFullYear() === year,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

// ─── Comparisons ─────────────────────────────────────────────────────────────

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Returns true if a is strictly after b at day granularity. */
export function isAfterDay(a: Date, b: Date): boolean {
  return toDateStr(a) > toDateStr(b)
}

// ─── Schedule helpers ─────────────────────────────────────────────────────────

type ScheduleInfo = { weekDays: string[]; startTime: string; endTime: string }

/** Returns "HH:MM – HH:MM" for the schedule active on date, or "". */
export function getScheduleTimeForDay(schedules: ScheduleInfo[], date: Date): string {
  const dow = JS_DAY_TO_ENUM[date.getDay()]
  const match = schedules.find((s) => s.weekDays.includes(dow))
  return match ? `${match.startTime} – ${match.endTime}` : ""
}

// ─── Display formatting ───────────────────────────────────────────────────────

/** Format date as "Lun 24 Mar" */
export function formatDayLabel(d: Date): string {
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`
}

/** Format week label as "Semana del 24 Mar" */
export function formatWeekLabel(weekStart: Date): string {
  const end = getWeekEnd(weekStart)
  if (weekStart.getMonth() === end.getMonth()) {
    return `${weekStart.getDate()}–${end.getDate()} ${MONTH_NAMES_SHORT[end.getMonth()]}`
  }
  return `${weekStart.getDate()} ${MONTH_NAMES_SHORT[weekStart.getMonth()]} – ${end.getDate()} ${MONTH_NAMES_SHORT[end.getMonth()]}`
}

/** Format month label as "Marzo 2026" */
export function formatMonthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month]} ${year}`
}
