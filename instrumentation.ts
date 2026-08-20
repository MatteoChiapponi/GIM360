/**
 * Hook de arranque del servidor de Next. Corre una sola vez por proceso, antes
 * de atender el primer request.
 *
 * Acá se clava la zona horaria del proceso en Argentina. El servidor está en
 * Estados Unidos, así que sin esto la hora local de Node —la que usan
 * `getDate()`, `getMonth()` y `new Date(y, m, d)`— sale corrida contra la de
 * los gimnasios: un pago cargado a las 22 h de Buenos Aires se guardaría con la
 * fecha del día siguiente.
 *
 * Node relee `process.env.TZ` cuando se le asigna, así que alcanza con setearlo
 * acá; no hace falta arrancar el proceso con `TZ=... next start` (que además no
 * es portable a Windows).
 *
 * Esto cubre el backend. En el navegador manda la zona de la máquina del
 * usuario, y por eso las fechas se calculan con `lib/timezone`, que es
 * explícito y no depende de la zona del runtime.
 */

import { TIMEZONE } from "@/lib/timezone"

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = TIMEZONE
  }
}
