/**
 * Plata: redondeo y formato, una sola definición para el backend y las vistas.
 *
 * Vive suelto en `lib/` y sin dependencias a propósito — lo importan tanto los
 * servicios como componentes "use client", y tener dos redondeos distintos es
 * la forma más fácil de que el monto que muestra la pantalla no sea el que se
 * termina guardando.
 */

/** Redondea a dos decimales. Todo monto que se guarda pasa por acá. */
export const round2 = (n: number) => Math.round(n * 100) / 100

/** "$12.500" — formato de pesos para la UI. */
export const formatMoney = (n: number) => `$${n.toLocaleString("es-AR")}`

/** "+$500" / "−$500" — un ajuste firmado, con el signo bien puesto para la UI. */
export const signedMoney = (n: number) => `${n < 0 ? "−" : "+"}${formatMoney(Math.abs(n))}`
