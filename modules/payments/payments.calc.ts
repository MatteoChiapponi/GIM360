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

/**
 * Hasta cuándo se conserva un descuento de "pago en término": el vencimiento de
 * la cuota más los días de gracia del descuento.
 *
 * Es un plazo aparte del vencimiento: la cuota puede figurar como Vencida y el
 * descuento seguir en pie mientras esté dentro de la gracia. Con `graceDays: 0`
 * los dos plazos coinciden.
 *
 * Los días se suman sobre el día del mes, no en milisegundos, así un cambio de
 * horario de verano no corre el plazo — y si se pasan de mes, `Date` lo resuelve.
 */
export function discountDeadlineFor(period: string, dueDay: number, graceDays: number): Date {
  const [year, month] = period.split("-").map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return new Date(year, month - 1, Math.min(dueDay, lastDay) + graceDays, 23, 59, 59)
}

/** ¿Se pasó el plazo para conservar el descuento de esa cuota? */
export function pastDiscountDeadline(
  period: string,
  dueDay: number,
  graceDays: number,
  now: Date = new Date(),
): boolean {
  return now > discountDeadlineFor(period, dueDay, graceDays)
}
