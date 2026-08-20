/** Errores de dominio del servicio de cuotas traducidos a HTTP. */
const PAYMENT_ERRORS: Record<string, { status: number; error: string }> = {
  PAYMENT_NOT_FOUND:       { status: 404, error: "La cuota no existe" },
  PAYMENT_ALREADY_PAID:    { status: 409, error: "La cuota ya está cobrada. Desmarcala como pagada para cambiar el descuento." },
  PAYMENT_WITHOUT_DISCOUNT:{ status: 409, error: "La cuota no tiene ningún descuento para aplicar" },
}

/** Devuelve la respuesta que corresponde, o null si el error no es de dominio. */
export function paymentError(err: unknown): { status: number; error: string } | null {
  if (!(err instanceof Error)) return null
  return PAYMENT_ERRORS[err.message] ?? null
}
