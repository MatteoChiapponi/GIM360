/**
 * Errores de dominio del servicio de descuentos traducidos a HTTP.
 * Vive acá y no en el route handler porque los comparten varias rutas
 * (asignar y editar la vigencia fallan por los mismos motivos).
 */
const DISCOUNT_ERRORS: Record<string, { status: number; error: string }> = {
  DISCOUNT_NOT_FOUND:   { status: 404, error: "El descuento no existe" },
  ASSIGNMENT_NOT_FOUND: { status: 404, error: "La asignación no existe" },
  DISCOUNT_INACTIVE:    { status: 409, error: "El descuento está desactivado" },
  OVERLAPPING_DISCOUNT: { status: 409, error: "El alumno ya tiene un descuento vigente en ese período" },
  INVALID_RANGE:        { status: 400, error: "El período final no puede ser anterior al inicial" },
  DISCOUNT_IN_USE:      { status: 409, error: "El descuento está asignado a alumnos. Quitáselo primero o desactivalo." },
}

/** Devuelve la respuesta que corresponde, o null si el error no es de dominio
 *  (esos suben y los loguea el wrapper como 500). */
export function discountError(err: unknown): { status: number; error: string } | null {
  if (!(err instanceof Error)) return null
  return DISCOUNT_ERRORS[err.message] ?? null
}
