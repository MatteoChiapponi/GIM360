-- Reinterpreta en hora de Argentina las columnas que guardan un día del
-- calendario, no un instante.
--
-- Hasta ahora esas fechas venían de un <input type="date"> y se guardaban con
-- `new Date("2026-08-20").toISOString()`, que JavaScript parsea como UTC: quedaba
-- 2026-08-20 00:00:00. Leída en Argentina (UTC-3) esa marca cae a las 21:00 del
-- día 19, así que el alumno veía un día menos del que había cargado. Desde este
-- cambio se guarda la medianoche argentina (2026-08-20 03:00:00), que es la que
-- se lee bien; estas filas quedaron con el criterio viejo.
--
-- El corrimiento no es un `+ 3 hours` fijo a propósito: `AT TIME ZONE` usa la
-- base de datos de zonas horarias, así que también acierta en las fechas
-- anteriores a 2009, cuando Argentina todavía movía el reloj en verano. Es el
-- mismo criterio que `argentinaDate()` en `lib/timezone.ts`, que resuelve el
-- offset con Intl: migración y código no pueden separarse.
--
-- Idempotente: solo toca las filas cuya hora es exactamente 00:00:00, que es la
-- firma del formato viejo. Corrida dos veces, la segunda no encuentra nada
-- porque las ya migradas quedaron en 03:00:00.
--
-- Quedan explícitamente afuera:
--   * "Payment"."period" y "Attendance"."date" — también son días del calendario,
--     pero por convención se guardan y se leen a medianoche UTC (`Date.UTC` /
--     `getUTC*`). Correrlas rompería justo lo que hoy funciona.
--   * "joinedAt", "leftAt", "enrolledAt", "paidAt", "fromDate", "toDate",
--     "createdAt", "updatedAt" — son instantes reales, no días: ya son correctos
--     en cualquier zona.

UPDATE "Trainer"
SET "startedAt" = ("startedAt"::date::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'UTC'
WHERE "startedAt" IS NOT NULL AND "startedAt"::time = '00:00:00';

UPDATE "Student"
SET "birthDate" = ("birthDate"::date::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'UTC'
WHERE "birthDate" IS NOT NULL AND "birthDate"::time = '00:00:00';

UPDATE "Student"
SET "trialEndsAt" = ("trialEndsAt"::date::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'UTC'
WHERE "trialEndsAt" IS NOT NULL AND "trialEndsAt"::time = '00:00:00';

UPDATE "Schedule"
SET "startDate" = ("startDate"::date::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'UTC'
WHERE "startDate"::time = '00:00:00';

UPDATE "Schedule"
SET "endDate" = ("endDate"::date::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'UTC'
WHERE "endDate" IS NOT NULL AND "endDate"::time = '00:00:00';
