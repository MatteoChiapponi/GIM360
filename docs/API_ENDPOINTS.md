# GYM360 — Documentacion de Endpoints API

> Todos los endpoints requieren autenticacion via cookie de sesion NextAuth (JWT).
> La autorizacion se verifica con el patron "Belongs" — el route handler chequea que el recurso pertenezca al usuario autenticado antes de llamar al servicio.

---

## Tabla de contenidos

- [Gyms](#gyms)
- [Students](#students)
- [Student Files](#student-files)
- [Trainers](#trainers)
- [Receptionists](#receptionists)
- [Groups](#groups)
- [Group Students (inscripciones)](#group-students-inscripciones)
- [Group Trainers (asignaciones)](#group-trainers-asignaciones)
- [Schedules](#schedules)
- [Expenses](#expenses)
- [Payments](#payments)
- [Late Fee (recargo por mora)](#late-fee-recargo-por-mora)
- [Cash Closings (cierres de caja)](#cash-closings-cierres-de-caja)
- [Metrics](#metrics)

---

## Gyms

### `GET /api/gyms`

**Para que sirve:** Listar los gimnasios del usuario autenticado.

**Roles:** `OWNER`, `TRAINER`, `RECEPTIONIST`

**Recibe:** Nada (identifica al usuario por sesion).
- Si es OWNER: retorna todos sus gimnasios.
- Si es TRAINER: retorna el gimnasio donde trabaja.

**Retorna:** `Gym[]`

**Donde se usa:** `app/(dashboard)/dashboard/page.tsx` — selector de gimnasio en el dashboard principal.

---

### `POST /api/gyms`

**Para que sirve:** Crear un nuevo gimnasio.

**Roles:** `OWNER`

**Recibe (body JSON):**
| Campo     | Tipo     | Requerido |
|-----------|----------|-----------|
| `name`    | string   | Si        |
| `address` | string   | No        |
| `phone`   | string   | No        |

**Retorna:** `Gym` (201 Created)

**Donde se usa:** No se usa actualmente en el frontend (preparado para futuro).

---

### `GET /api/gyms/:id`

**Para que sirve:** Obtener un gimnasio por ID.

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe:** `id` en la URL.

**Retorna:** `Gym`

**Donde se usa:** `PaymentsView.tsx` y `MetricsView.tsx` — para obtener datos del gym (nombre, estado).

---

### `PATCH /api/gyms/:id`

**Para que sirve:** Actualizar un gimnasio.

**Roles:** `OWNER`

**Recibe (body JSON):** Campos parciales de:
| Campo     | Tipo     | Requerido |
|-----------|----------|-----------|
| `name`    | string   | No        |
| `address` | string   | No        |
| `phone`   | string   | No        |

**Retorna:** `Gym` actualizado.

**Donde se usa:** No se usa actualmente en el frontend.

---

### `DELETE /api/gyms/:id`

**Para que sirve:** Eliminar un gimnasio.

**Roles:** `OWNER`

**Recibe:** `id` en la URL.

**Retorna:** 204 No Content.

**Donde se usa:** No se usa actualmente en el frontend.

---

## Students

### `GET /api/students?gymId=xxx`

**Para que sirve:** Listar todos los alumnos de un gimnasio.

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe (query params):**
| Param  | Tipo   | Requerido |
|--------|--------|-----------|
| `gymId`| string | Si        |

**Retorna:** `Student[]`

**Donde se usa:** `StudentsView.tsx` — tabla de alumnos. `GroupDetailView.tsx` — selector de alumnos para inscribir.

---

### `POST /api/students`

**Para que sirve:** Crear un nuevo alumno.

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe (body JSON):**
| Campo             | Tipo     | Requerido |
|-------------------|----------|-----------|
| `gymId`           | string   | Si        |
| `firstName`       | string   | Si        |
| `lastName`        | string   | Si        |
| `phone1`          | string   | Si (min 8 digitos) |
| `dueDay`          | number   | No (1-31) |
| `birthDate`       | datetime | No        |
| `nationalId`      | string   | No        |
| `phone2`          | string   | No        |
| `emergencyPhone`  | string   | No        |
| `emergencyContact`| string   | No        |
| `status`          | enum     | No (ACTIVE, TRIAL, INACTIVE, GRADUATED) |
| `trialEndsAt`     | datetime | No        |

**Retorna:** `Student` (201 Created)

**Donde se usa:** `StudentsView.tsx` — formulario de alta de alumno.

---

### `GET /api/students/:id?gymId=xxx`

**Para que sirve:** Obtener un alumno por ID.

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe:** `id` en URL + `gymId` en query param.

**Retorna:** `Student`

**Donde se usa:** `StudentsView.tsx` — detalle de alumno en el panel lateral.

---

### `PATCH /api/students/:id?gymId=xxx`

**Para que sirve:** Actualizar datos de un alumno.

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe (body JSON):** Campos parciales (mismos que POST, excepto `gymId`).

**Retorna:** `Student` actualizado.

**Donde se usa:** `StudentsView.tsx` — edicion de datos del alumno, cambio de estado.

---

### `DELETE /api/students/:id?gymId=xxx`

**Para que sirve:** Desactivar un alumno (soft delete — setea `leftAt`).

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe:** `id` en URL + `gymId` en query param.

**Retorna:** `Student` desactivado.

**Donde se usa:** `StudentsView.tsx` — boton de dar de baja.

---

## Student Files

### `GET /api/students/:id/files?gymId=xxx`

**Para que sirve:** Listar archivos de un alumno (fichas, aptos medicos) con URLs firmadas para descarga.

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe:** `id` del estudiante en URL + `gymId` en query param.

**Retorna:** `StudentFile[]` — cada uno incluye `signedUrl` (URL firmada de Supabase Storage, 1 hora de validez).

**Donde se usa:** `StudentsView.tsx` — seccion de archivos del alumno.

---

### `POST /api/students/:id/files`

**Para que sirve:** Subir un archivo para un alumno a Supabase Storage.

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe (FormData):**
| Campo      | Tipo   | Requerido |
|------------|--------|-----------|
| `gymId`    | string | Si        |
| `fileType` | enum   | Si (`FICHA` o `APTO_MEDICO`) |
| `file`     | File   | Si (PDF, JPEG, PNG, WEBP. Max 10 MB) |

**Retorna:** `StudentFile` (201 Created)

**Donde se usa:** `StudentsView.tsx` — upload de ficha o apto medico.

---

### `GET /api/students/:id/files/:fileId/download?gymId=xxx`

**Para que sirve:** Descargar un archivo — genera una URL firmada (5 min) y redirige.

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe:** `id` del estudiante, `fileId` en URL + `gymId` en query param.

**Retorna:** Redirect 302 a la URL firmada de Supabase.

**Donde se usa:** `StudentsView.tsx` — link de descarga de archivos.

---

### `DELETE /api/students/:id/files/:fileId?gymId=xxx`

**Para que sirve:** Eliminar un archivo del alumno (borra de Supabase Storage + registro DB).

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe:** `id` del estudiante, `fileId` en URL + `gymId` en query param.

**Retorna:** 204 No Content.

**Donde se usa:** `StudentsView.tsx` — boton de eliminar archivo.

---

## Trainers

### `GET /api/trainers?gymId=xxx`

**Para que sirve:** Listar todos los entrenadores de un gimnasio.

**Roles:** `OWNER`

**Recibe (query params):**
| Param  | Tipo   | Requerido |
|--------|--------|-----------|
| `gymId`| string | Si        |

**Retorna:** `Trainer[]`

**Donde se usa:** `TrainersView.tsx` — tabla de entrenadores. `GroupDetailView.tsx` — selector para asignar entrenadores.

---

### `POST /api/trainers`

**Para que sirve:** Crear un nuevo entrenador.

**Roles:** `OWNER`

**Recibe (body JSON):**
| Campo       | Tipo     | Requerido |
|-------------|----------|-----------|
| `gymId`     | string   | Si        |
| `name`      | string   | Si        |
| `startedAt` | datetime | No        |

**Retorna:** `Trainer` (201 Created)

**Donde se usa:** `TrainersView.tsx` — formulario de alta de entrenador.

---

### `PATCH /api/trainers/:id?gymId=xxx`

**Para que sirve:** Actualizar un entrenador.

**Roles:** `OWNER`

**Recibe (body JSON):** Campos parciales:
| Campo       | Tipo     | Requerido |
|-------------|----------|-----------|
| `name`      | string   | No        |
| `startedAt` | datetime | No        |

**Retorna:** `Trainer` actualizado.

**Donde se usa:** `TrainersView.tsx` — edicion de datos del entrenador.

---

### `DELETE /api/trainers/:id?gymId=xxx`

**Para que sirve:** Desactivar un entrenador (soft delete — `active = false`).

**Roles:** `OWNER`

**Recibe:** `id` en URL + `gymId` en query param.

**Retorna:** 204 No Content.

**Donde se usa:** `TrainersView.tsx` — boton de dar de baja.

---

## Receptionists

> El recepcionista pertenece a un solo gimnasio (`Receptionist.gymId`) y siempre tiene un `User`
> asociado — el registro existe unicamente para darle acceso. `active: false` corta el acceso sin
> borrar el registro.

### `GET /api/receptionists?gymId=xxx`

**Para que sirve:** Listar los recepcionistas de un gimnasio.

**Roles:** `OWNER`

**Recibe (query):** `gymId` (requerido).

**Retorna:** `Receptionist[]` con `user.email`.

**Donde se usa:** `ReceptionistsView.tsx` — tabla de accesos de recepcion.

---

### `POST /api/receptionists`

**Para que sirve:** Crear un recepcionista junto con su usuario de login (transaccional).

**Roles:** `OWNER`

**Recibe (body JSON):**
| Campo      | Tipo   | Requerido |
|------------|--------|-----------|
| `gymId`    | string | Si        |
| `name`     | string | Si        |
| `email`    | string | Si        |
| `password` | string | Si (min 8)|

**Retorna:** `Receptionist` (201 Created). `409` si el email ya esta registrado en GYM360.

**Donde se usa:** `ReceptionistsView.tsx` — modal "Nuevo recepcionista".

---

### `PATCH /api/receptionists/:id?gymId=xxx`

**Para que sirve:** Renombrar o activar/desactivar el acceso.

**Roles:** `OWNER`

**Recibe (body JSON):** `name` (opcional), `active` (opcional).

**Retorna:** `Receptionist`.

**Donde se usa:** `ReceptionistsView.tsx` — boton Activar/Desactivar.

---

### `POST /api/receptionists/:id/password?gymId=xxx`

**Para que sirve:** Resetear la contraseña del recepcionista.

**Roles:** `OWNER`

**Recibe (body JSON):** `password` (requerido, min 8).

**Retorna:** 204 No Content.

**Donde se usa:** `ReceptionistsView.tsx` — modal "Nueva contraseña".

---

### `DELETE /api/receptionists/:id?gymId=xxx`

**Para que sirve:** Eliminar el acceso. Borra el `User`, que arrastra al `Receptionist` por cascade.

**Roles:** `OWNER`

**Retorna:** 204 No Content.

**Donde se usa:** `ReceptionistsView.tsx` — boton Eliminar.

---

### `GET /api/receptionists/me`

**Para que sirve:** Perfil del recepcionista autenticado, con su gimnasio.

**Roles:** `RECEPTIONIST`

**Recibe:** Nada (identifica al usuario por sesion).

**Retorna:** `Receptionist` con `gym: { id, name, status }`.

**Donde se usa:** Resolucion del gimnasio propio (`/reception`).

---

## Groups

### `GET /api/groups?gymId=xxx`

**Para que sirve:** Listar todos los grupos de un gimnasio.

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe (query params):**
| Param  | Tipo   | Requerido |
|--------|--------|-----------|
| `gymId`| string | Si        |

**Retorna:** `Group[]` (incluye relaciones: students, trainers, schedules).

**Donde se usa:** `GroupsView.tsx` — tarjetas de grupos. `TrainersView.tsx` y `StudentsView.tsx` — selectores de grupo.

---

### `POST /api/groups`

**Para que sirve:** Crear un nuevo grupo.

**Roles:** `OWNER`

**Recibe (body JSON):**
| Campo          | Tipo   | Requerido |
|----------------|--------|-----------|
| `gymId`        | string | Si        |
| `name`         | string | Si        |
| `monthlyPrice` | number | Si (positivo, 2 decimales) |
| `maxCapacity`  | number | No (entero positivo) |

**Retorna:** `Group` (201 Created)

**Donde se usa:** `GroupsView.tsx` — formulario de creacion de grupo.

---

### `GET /api/groups/:id?gymId=xxx`

**Para que sirve:** Obtener un grupo con todos sus datos (alumnos, entrenadores, horarios).

**Roles:** `OWNER`

**Recibe:** `id` en URL + `gymId` en query param.

**Retorna:** `Group` con includes (students, trainers con schedules, schedules).

**Donde se usa:** `GroupDetailView.tsx` — vista de detalle de grupo.

---

### `PATCH /api/groups/:id?gymId=xxx`

**Para que sirve:** Actualizar un grupo.

**Roles:** `OWNER`

**Recibe (body JSON):** Campos parciales:
| Campo          | Tipo   | Requerido |
|----------------|--------|-----------|
| `name`         | string | No        |
| `monthlyPrice` | number | No        |
| `maxCapacity`  | number | No        |

**Retorna:** `Group` actualizado.

**Donde se usa:** `GroupDetailView.tsx` — edicion de nombre, precio, capacidad.

---

### `DELETE /api/groups/:id?gymId=xxx`

**Para que sirve:** Eliminar un grupo.

**Roles:** `OWNER`

**Recibe:** `id` en URL + `gymId` en query param.

**Retorna:** 204 No Content.

**Donde se usa:** `GroupsView.tsx` — boton de eliminar grupo (con confirmacion).

---

## Group Students (inscripciones)

### `POST /api/groups/:id/students?gymId=xxx`

**Para que sirve:** Inscribir un alumno en un grupo (crear registro `StudentGroup`).

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe (body JSON):**
| Campo       | Tipo   | Requerido |
|-------------|--------|-----------|
| `studentId` | string | Si        |

**Retorna:** `StudentGroup` (201 Created)

**Donde se usa:** `StudentsView.tsx` — al crear alumno con grupo. `GroupDetailView.tsx` — inscribir alumno existente.

---

### `DELETE /api/groups/:id/students/:studentId?gymId=xxx`

**Para que sirve:** Desinscribir un alumno de un grupo (eliminar `StudentGroup`).

**Roles:** `OWNER`

**Recibe:** `id` del grupo + `studentId` en URL + `gymId` en query param.

**Retorna:** 204 No Content.

**Donde se usa:** `GroupDetailView.tsx` — boton de quitar alumno del grupo.

---

## Group Trainers (asignaciones)

### `POST /api/groups/:id/trainers?gymId=xxx`

**Para que sirve:** Asignar un entrenador a un grupo con horarios y tarifa.

**Roles:** `OWNER`

**Recibe (body JSON):**
| Campo         | Tipo   | Requerido |
|---------------|--------|-----------|
| `trainerId`   | string | Si        |
| `hourlyRate`  | number | Si (positivo, 2 decimales) |
| `schedules`   | array  | Si (min 1 entrada) |
| `forceOverlap`| boolean| No (ignora conflictos de horario) |

Cada entrada de `schedules`:
| Campo       | Tipo   | Requerido |
|-------------|--------|-----------|
| `weekDay`   | DayOfWeek enum | Si |
| `startTime` | string (HH:MM) | Si |
| `endTime`   | string (HH:MM) | Si |

**Validaciones adicionales:**
- Los dias deben pertenecer al horario del grupo.
- Las horas no deben exceder el rango del horario del grupo.
- Si hay superposicion con otros grupos, retorna 409 con detalle de conflictos (a menos que `forceOverlap: true`).

**Retorna:** `TrainerGroup` (201 Created) o 409 con `{ error, conflicts[] }`.

**Donde se usa:** `TrainersView.tsx` — asignar profesor al crear. `GroupDetailView.tsx` — modal de asignar profesor.

---

### `PATCH /api/groups/:id/trainers/:trainerId?gymId=xxx`

**Para que sirve:** Actualizar la asignacion de un entrenador (tarifa y/o horarios).

**Roles:** `OWNER`

**Recibe (body JSON):**
| Campo         | Tipo   | Requerido |
|---------------|--------|-----------|
| `hourlyRate`  | number | Si        |
| `schedules`   | array  | Si (min 1) |
| `forceOverlap`| boolean| No        |

**Retorna:** `TrainerGroup` actualizado o 409 con conflictos.

**Donde se usa:** `GroupDetailView.tsx` — edicion de horarios/tarifa de un profesor asignado.

---

### `DELETE /api/groups/:id/trainers/:trainerId?gymId=xxx`

**Para que sirve:** Desasignar un entrenador de un grupo.

**Roles:** `OWNER`

**Recibe:** `id` del grupo + `trainerId` en URL + `gymId` en query param.

**Retorna:** 204 No Content.

**Donde se usa:** `GroupDetailView.tsx` — boton de quitar entrenador del grupo.

---

## Schedules

### `POST /api/schedules?gymId=xxx`

**Para que sirve:** Crear un horario para un grupo.

**Roles:** `OWNER`

**Recibe (body JSON):**
| Campo       | Tipo          | Requerido |
|-------------|---------------|-----------|
| `groupId`   | string        | Si        |
| `weekDays`  | DayOfWeek[]   | Si (min 1) |
| `startTime` | string (HH:MM)| Si        |
| `endTime`   | string (HH:MM)| Si        |
| `startDate` | datetime      | Si        |
| `endDate`   | datetime      | No        |

**Retorna:** `Schedule` (201 Created)

**Donde se usa:** `GroupsView.tsx` — al crear grupo con horarios. `GroupDetailView.tsx` — agregar horario.

---

### `PATCH /api/schedules/:id?gymId=xxx`

**Para que sirve:** Actualizar un horario.

**Roles:** `OWNER`

**Recibe (body JSON):** Campos parciales (mismos que POST excepto `groupId`).

**Retorna:** `Schedule` actualizado.

**Donde se usa:** `GroupDetailView.tsx` — edicion de horarios.

---

### `DELETE /api/schedules/:id?gymId=xxx`

**Para que sirve:** Eliminar un horario de un grupo.

**Roles:** `OWNER`

**Recibe:** `id` en URL + `gymId` en query param.

**Retorna:** 204 No Content.

**Donde se usa:** `GroupDetailView.tsx` — boton de eliminar horario.

---

## Expenses

### `GET /api/expenses?gymId=xxx`

**Para que sirve:** Listar todos los gastos fijos de un gimnasio.

**Roles:** `OWNER`

**Recibe (query params):**
| Param  | Tipo   | Requerido |
|--------|--------|-----------|
| `gymId`| string | Si        |

**Retorna:** `FixedExpense[]`

**Donde se usa:** `ExpensesView.tsx` — tabla de gastos fijos.

---

### `POST /api/expenses`

**Para que sirve:** Crear un gasto fijo.

**Roles:** `OWNER`

**Recibe (body JSON):**
| Campo    | Tipo   | Requerido |
|----------|--------|-----------|
| `gymId`  | string | Si        |
| `name`   | string | Si        |
| `amount` | number | Si (positivo, 2 decimales) |

**Retorna:** `FixedExpense` (201 Created)

**Donde se usa:** `ExpensesView.tsx` — formulario de nuevo gasto.

---

### `PATCH /api/expenses/:id?gymId=xxx`

**Para que sirve:** Actualizar un gasto fijo.

**Roles:** `OWNER`

**Recibe (body JSON):** Campos parciales:
| Campo    | Tipo   | Requerido |
|----------|--------|-----------|
| `name`   | string | No        |
| `amount` | number | No        |

**Retorna:** `FixedExpense` actualizado.

**Donde se usa:** `ExpensesView.tsx` — edicion inline de gasto.

---

### `DELETE /api/expenses/:id?gymId=xxx`

**Para que sirve:** Eliminar un gasto fijo.

**Roles:** `OWNER`

**Recibe:** `id` en URL + `gymId` en query param.

**Retorna:** 204 No Content.

**Donde se usa:** `ExpensesView.tsx` — boton de eliminar gasto.

---

## Payments

### `GET /api/payments?gymId=xxx&period=YYYY-MM`

**Para que sirve:** Listar pagos de un periodo o de un alumno.

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe (query params):**
| Param       | Tipo   | Requerido |
|-------------|--------|-----------|
| `gymId`     | string | Si        |
| `period`    | string | Si (si no hay studentId). Formato: `YYYY-MM` |
| `studentId` | string | No (si se pasa, retorna pagos de ese alumno) |

**Logica:**
- Si se pasa `studentId`: retorna todos los pagos de ese alumno (sin filtro por periodo).
- Si no: retorna pagos del periodo indicado.

**Retorna:** `Payment[]`

**Donde se usa:** `PaymentsView.tsx` — tabla de cobros del periodo. `StudentsView.tsx` — historial de pagos del alumno. `GroupDetailView.tsx` — pagos del grupo.

---

### `POST /api/payments`

**Para que sirve:** Generar boletas de pago mensuales para todos los alumnos activos del gimnasio.

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe (body JSON):**
| Campo    | Tipo   | Requerido |
|----------|--------|-----------|
| `gymId`  | string (CUID) | Si |
| `period` | string | Si (formato `YYYY-MM`) |

**Logica:** Crea un registro `Payment` por cada alumno activo inscrito en al menos un grupo. El monto se calcula como la suma de `monthlyPrice` de cada grupo al que pertenece.

**Retorna:** `Payment[]` (201 Created)

**Donde se usa:** `PaymentsView.tsx` — se auto-genera al entrar a un periodo si no existen pagos.

---

### `PATCH /api/payments/:id?gymId=xxx`

**Para que sirve:** Actualizar un pago (marcar como pagado, cambiar estado, notas, monto).

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe (body JSON):**
| Campo           | Tipo   | Requerido |
|-----------------|--------|-----------|
| `status`        | enum   | No (`PENDING`, `PAID`, `EXPIRED`, `PARTIAL`) |
| `paymentMethod` | enum   | No (requerido si status=PAID). `CASH`, `TRANSFER`, `CARD`, `OTHER` |
| `paidAt`        | datetime | No |
| `notes`         | string | No |
| `amount`        | number | No |
| `lateFeeWaived` | boolean | No (condona el recargo por mora de esta cuota) |
| `chargedAmount` | number \| null | No (monto que se cobro de verdad; `null` borra el ajuste manual) |
| `manualAdjustmentReason` | string \| null | No (motivo del ajuste manual, max 200) |

**Validaciones:**
- No se puede modificar un pago verificado (cierre de caja ya realizado).
- Si `status = PAID`, `paymentMethod` es obligatorio.
- Si `status != PAID`, `paymentMethod` se limpia automaticamente.
- Cobrar con un medio de pago deshabilitado devuelve 400.

**Logica de montos:** el backend recalcula lo que se cobra y guarda la descomposicion
`amount = baseAmount + lateFee + methodAdjustment + manualAdjustment`:
- `baseAmount` — la cuota limpia.
- `lateFee` / `lateDays` — recargo por mora segun la regla del gimnasio y los dias de atraso a la
  fecha de `paidAt`. Queda en 0 si el alumno es `lateFeeExempt` o si se manda `lateFeeWaived`.
- `methodAdjustment` — recargo o descuento del medio de pago, calculado sobre cuota + mora.
- `manualAdjustment` — la diferencia entre lo que dan esas reglas y el `chargedAmount` que manda
  quien cobra: el redondeo del mostrador. Va firmado (+ se cobro de mas / − de menos) y se guarda
  con su `manualAdjustmentReason`. Un ajuste ya guardado se mantiene si la edicion no manda
  `chargedAmount` (corregirle el medio a un pago no borra el redondeo); `chargedAmount: null` lo
  borra y devuelve el pago al monto calculado.

Al despagar (o al limpiar el medio), `amount` vuelve a la cuota limpia y el resto se pone en `null`.

**Retorna:** `Payment` actualizado.

**Donde se usa:** `PaymentsView.tsx` — modal de cobro (medio de pago, condonar la mora y ajustar el
monto a cobrar), cancelar un cobro (`status: PENDING`, que devuelve la cuota limpia) y editar
monto/notas.

---

### `DELETE /api/payments/:id?gymId=xxx`

**Para que sirve:** Eliminar un pago.

**Roles:** `OWNER`

**Recibe:** `id` en URL + `gymId` en query param.

**Retorna:** 204 No Content.

**Donde se usa:** Ningun lugar de la UI. Cancelar un cobro se hace con `PATCH status: PENDING`, que
deja la cuota impaga en vez de borrarla; este DELETE borra el registro y queda para el owner.

---

## Late Fee (recargo por mora)

### `GET /api/late-fee?gymId=xxx`

**Para que sirve:** Leer la regla de recargo por mora del gimnasio.

**Roles:** `OWNER`, `RECEPTIONIST`

**Recibe (query params):** `gymId` (requerido).

**Retorna:** `{ enabled, graceDays, feeType, feeValue, repeatEveryDays, maxCharges, maxFeeAmount }`. Un gimnasio que
nunca la configuro devuelve el default: la regla apagada.

**Donde se usa:** `LateFeeSettings.tsx` — formulario de configuracion. `PaymentsView.tsx` —
vista previa del recargo antes de cobrar.

---

### `PATCH /api/late-fee`

**Para que sirve:** Configurar el recargo por mora del gimnasio.

**Roles:** `OWNER`

**Recibe (body JSON):**
| Campo          | Tipo    | Requerido |
|----------------|---------|-----------|
| `gymId`        | string  | Si |
| `enabled`      | boolean | Si |
| `graceDays`    | number  | Si (entero, 0 a 365) |
| `feeType`      | enum    | Si (`FIXED`, `PERCENT`) |
| `feeValue`     | number  | Si (pesos si `FIXED`, % si `PERCENT`) |
| `repeatEveryDays` | number \| null | Si (cada cuantos dias se repite; `null` = una sola vez) |
| `maxCharges`   | number \| null | Si (tope de veces que se cobra; `null` = sin tope) |
| `maxFeeAmount` | number \| null | Si (tope del recargo acumulado en pesos; `null` = sin tope) |

**Validaciones:**
- Con `enabled = true`, `feeValue` tiene que ser mayor a 0.
- Con `feeType = PERCENT`, `feeValue` no puede superar 100.
- `maxCharges` solo se acepta si el recargo se repite (`repeatEveryDays` no nulo).
- El gimnasio tiene que estar activo.

**Retorna:** la regla guardada.

**Donde se usa:** `LateFeeSettings.tsx` — boton de guardar.

---

## Cash Closings (cierres de caja)

### `GET /api/cash-closings?gymId=xxx`

**Para que sirve:** Listar todos los cierres de caja de un gimnasio.

**Roles:** `OWNER`

**Recibe (query params):**
| Param  | Tipo   | Requerido |
|--------|--------|-----------|
| `gymId`| string | Si        |

**Retorna:** `CashClosing[]`

**Donde se usa:** No se lista actualmente (uso futuro). El POST se usa desde PaymentsView.

---

### `POST /api/cash-closings`

**Para que sirve:** Crear un cierre de caja — marca como verificados todos los pagos PAID no verificados del gimnasio.

**Roles:** `OWNER`

**Recibe (body JSON):**
| Campo   | Tipo   | Requerido |
|---------|--------|-----------|
| `gymId` | string (CUID) | Si |
| `notes` | string | No |

**Retorna:** `CashClosing` (201 Created) con totales por metodo de pago. `adjustmentsCount` y
`adjustmentsTotal` resumen lo que se ajusto a mano al cobrar: ya esta dentro de `totalCollected`,
se informa aparte para ver la diferencia contra lo que decian las cuotas.

**Donde se usa:** `PaymentsView.tsx` — boton "Cerrar caja".

---

### `GET /api/cash-closings/:id?gymId=xxx`

**Para que sirve:** Obtener detalle de un cierre de caja.

**Roles:** `OWNER`

**Recibe:** `id` en URL + `gymId` en query param.

**Retorna:** `CashClosing` con pagos incluidos.

**Donde se usa:** No se usa actualmente en el frontend.

---

## Metrics

> Todos los endpoints de metricas comparten los mismos query params y solo son accesibles por `OWNER`.

### Query params comunes:
| Param    | Tipo   | Requerido |
|----------|--------|-----------|
| `gymId`  | string (CUID) | Si |
| `period` | string | Si (formato `YYYY-MM`) |

---

### `GET /api/metrics/gym?gymId=xxx&period=YYYY-MM`

**Para que sirve:** Obtener metricas financieras del gimnasio (EBITDA).

**Roles:** `OWNER`

**Retorna:**
```json
{
  "gymId": "string",
  "period": "YYYY-MM",
  "totalCollectedRevenue": 150000,
  "totalPendingRevenue": 25000,
  "totalTrainerCost": 45000,
  "totalFixedExpenses": 30000,
  "ebitda": 75000
}
```

| Campo                   | Descripcion |
|-------------------------|-------------|
| `totalCollectedRevenue` | Suma de pagos PAID del periodo |
| `totalPendingRevenue`   | Suma de pagos PENDING + EXPIRED del periodo |
| `totalTrainerCost`      | Costo de entrenadores: tarifa/hora x horas mensuales estimadas |
| `totalFixedExpenses`    | Suma de gastos fijos del gimnasio |
| `ebitda`                | collectedRevenue - trainerCost - fixedExpenses |

**Donde se usa:** `MetricsView.tsx` — tab "Finanzas".

---

### `GET /api/metrics/groups?gymId=xxx&period=YYYY-MM`

**Para que sirve:** Obtener metricas de rentabilidad por grupo.

**Roles:** `OWNER`

**Retorna:** `GroupMetrics[]`
```json
[{
  "groupId": "string",
  "groupName": "Nivel 1",
  "monthlyPrice": 25000,
  "activeStudents": 12,
  "maxCapacity": 15,
  "occupancyRate": 0.8,
  "projectedRevenue": 300000,
  "collectedRevenue": 275000,
  "monthlyHours": 26,
  "trainerCost": 45000,
  "margin": 230000,
  "breakevenStudents": 2
}]
```

| Campo               | Descripcion |
|---------------------|-------------|
| `occupancyRate`     | alumnos / capacidad maxima (null si no tiene max) |
| `projectedRevenue`  | alumnos activos x precio mensual |
| `collectedRevenue`  | pagos PAID distribuidos proporcionalmente entre grupos |
| `monthlyHours`      | horas mensuales estimadas (sesiones x 4.33) |
| `trainerCost`       | costo de profesores del grupo |
| `margin`            | collectedRevenue - trainerCost |
| `breakevenStudents` | alumnos minimos para cubrir costo de profesores |

**Donde se usa:** `MetricsView.tsx` — tab "Grupos".

---

### `GET /api/metrics/health?gymId=xxx&period=YYYY-MM`

**Para que sirve:** Obtener el indice de salud del gimnasio (score 0-100) desglosado en 4 dimensiones.

**Roles:** `OWNER`

**Retorna:**
```json
{
  "score": 72,
  "label": "En desarrollo",
  "dim1Rentabilidad": { "score": 25, "maxScore": 35, "weightedMarginPct": 0.42 },
  "dim2Ocupacion": {
    "score": 28, "maxScore": 35,
    "occupancyRate": 0.72, "totalStudents": 36, "totalCapacity": 50,
    "hasGroupsWithoutCapacity": false
  },
  "dim3Eficiencia": { "score": 7, "maxScore": 10, "costRatio": 0.58 },
  "dim4Ganancias": { "score": 12, "maxScore": 20, "ebitdaMargin": 0.18 }
}
```

| Dimension           | Max | Descripcion |
|---------------------|-----|-------------|
| `dim1Rentabilidad`  | 35  | Margen ponderado por grupo (ingresos vs costos de profesores) |
| `dim2Ocupacion`     | 35  | Tasa de ocupacion global (alumnos / capacidad) |
| `dim3Eficiencia`    | 10  | Ratio de costos totales / ingresos |
| `dim4Ganancias`     | 20  | Margen EBITDA sobre ingresos |

**Labels:** `Saludable` (>=80), `En desarrollo` (>=60), `Con problemas` (>=40), `Critico` (<40)

**Donde se usa:** `MetricsView.tsx` — tab "Optimizacion".

---

## Codigos de respuesta comunes

| Codigo | Significado |
|--------|-------------|
| 200    | OK |
| 201    | Creado exitosamente |
| 204    | Eliminado sin contenido |
| 400    | Parametros invalidos o faltantes |
| 401    | No autenticado |
| 403    | No autorizado (recurso no pertenece al usuario o gym inactivo) |
| 404    | Recurso no encontrado |
| 409    | Conflicto (pago verificado, superposicion de horarios) |
| 500    | Error del servidor |
