/**
 * Reglas de fecha de las cuotas, sin DB. Vive aparte del servicio para poder
 * testear el vencimiento sin montar un escenario entero.
 */

/**
 * Momento exacto en que vence la cuota de un período: el `dueDay` del alumno a
 * las 23:59:59. Si el mes es más corto que el `dueDay` (un 31 en febrero), vence
 * el último día del mes.
 *
 * Se calcula en hora local a propósito: es la fecha que ve el gimnasio, y es la
 * misma que muestra la columna "Vencimiento" en la vista de Cuotas.
 */
export function dueDateFor(period: string, dueDay: number): Date {
  const [year, month] = period.split("-").map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(dueDay, lastDay), 23, 59, 59)
}

/** ¿La cuota de ese período ya venció para ese alumno? */
export function isOverdue(period: string, dueDay: number, now: Date = new Date()): boolean {
  return now > dueDateFor(period, dueDay)
}
