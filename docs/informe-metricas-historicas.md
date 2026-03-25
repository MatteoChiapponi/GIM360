# Informe: Problema de Metricas Historicas en GYM360

## Resumen del problema

Las metricas de GYM360 combinan datos historicos (pagos) con datos de estado actual (alumnos, profesores, gastos fijos). Cuando un usuario consulta un mes pasado, los pagos reflejan ese periodo correctamente, pero los costos de estructura reflejan la configuracion actual del gimnasio, no la de ese mes. Esto produce metricas incorrectas.

---

## Estado real del gimnasio (lo que paso en cada momento)

### Enero 2025

| Grupo        | Alumnos activos | Capacidad | Precio mensual | Profesores              | Costo profesores |
|--------------|-----------------|-----------|----------------|-------------------------|------------------|
| Mini (4-6)   | 8               | 10        | $15.000        | Laura ($800/h, 8h/sem)  | $13.856          |
| Juvenil      | 12              | 15        | $20.000        | Laura + Pedro ($1.000/h, 10h/sem) | $13.856 + $17.320 = $31.176 |

- **Gastos fijos**: Alquiler $80.000 + Servicios $15.000 = **$95.000**
- **Pagos cobrados**: 18 de 20 alumnos pagaron = **$370.000**
- **Pagos pendientes**: 2 alumnos = **$30.000**

### Febrero 2025

Cambios que ocurrieron:
- Pedro renuncio. Lo reemplazo Martin ($1.200/h) en Juvenil.
- Se inscribieron 3 alumnos nuevos en Juvenil (ahora 15).
- Se fue 1 alumno de Mini (ahora 7).
- Subio el alquiler a $90.000. Gastos fijos ahora = **$105.000**
- Se aumento la capacidad de Juvenil a 20.

| Grupo        | Alumnos activos | Capacidad | Precio mensual | Profesores                | Costo profesores |
|--------------|-----------------|-----------|----------------|---------------------------|------------------|
| Mini (4-6)   | 7               | 10        | $15.000        | Laura ($800/h, 8h/sem)    | $13.856          |
| Juvenil      | 15              | 20        | $20.000        | Laura + Martin ($1.200/h, 10h/sem) | $13.856 + $20.784 = $34.640 |

- **Gastos fijos**: $105.000
- **Pagos cobrados**: 20 de 22 pagaron = **$405.000**
- **Pagos pendientes**: 2 alumnos = **$40.000**

---

## Caso 1: Tab "Gimnasio" — Consultar Enero desde Marzo

### Valores correctos (lo que realmente paso en Enero)

| Metrica              | Valor real Enero |
|----------------------|------------------|
| Ingresos cobrados    | $370.000         |
| Ingresos pendientes  | $30.000          |
| Costo profesores     | $45.032          |
| Gastos fijos         | $95.000          |
| **EBITDA**           | **$229.968**     |

### Lo que muestra el sistema hoy (Enero visto desde Marzo)

El sistema toma los pagos de enero (correctos) pero usa los costos ACTUALES de marzo:

| Metrica              | Valor mostrado | Correcto? | Error                                      |
|----------------------|----------------|-----------|---------------------------------------------|
| Ingresos cobrados    | $370.000       | SI        | Los pagos estan en la DB con fecha          |
| Ingresos pendientes  | $30.000        | SI        | Idem                                        |
| Costo profesores     | $48.496        | NO        | Usa a Martin ($1.200/h) en vez de Pedro ($1.000/h) |
| Gastos fijos         | $105.000       | NO        | Usa el alquiler actual ($90.000), no el de enero ($80.000) |
| **EBITDA**           | **$216.504**   | NO        | **Diferencia de $13.464 (5.8% de error)**   |

**Impacto**: El EBITDA de enero aparece $13.464 menor de lo que realmente fue. Un dueno que compare enero vs febrero pensaria que enero fue peor de lo que fue.

---

## Caso 2: Tab "Grupos" — Consultar Enero para grupo Juvenil desde Marzo

### Valores correctos (Enero real)

| Metrica              | Valor real Enero |
|----------------------|------------------|
| Alumnos activos      | 12               |
| Capacidad            | 15               |
| Ocupacion            | 80%              |
| Ingreso proyectado   | $240.000         |
| Ingreso cobrado      | $220.000         |
| Tasa de cobranza     | 91.7%            |
| Costo profesores     | $31.176          |
| Margen               | $188.824         |
| Punto de equilibrio  | 2 alumnos        |

### Lo que muestra el sistema hoy (Enero visto desde Marzo)

| Metrica              | Valor mostrado | Correcto? | Error                                           |
|----------------------|----------------|-----------|--------------------------------------------------|
| Alumnos activos      | 15             | NO        | Muestra los actuales, no los de enero            |
| Capacidad            | 20             | NO        | Se cambio en febrero                             |
| Ocupacion            | 75%            | NO        | 15/20 actual vs 12/15 real = **80% real**        |
| Ingreso proyectado   | $300.000       | NO        | 15 x $20.000 actual vs 12 x $20.000 = $240.000  |
| Ingreso cobrado      | $220.000       | SI        | Pagos estan en la DB                             |
| Tasa de cobranza     | 73.3%          | NO        | $220k/$300k vs real $220k/$240k = **91.7%**      |
| Costo profesores     | $34.640        | NO        | Usa Martin ($1.200/h) en vez de Pedro ($1.000/h) |
| Margen               | $185.360       | NO        | Cobrado real - costo actual                      |
| Punto de equilibrio  | 2 alumnos      | SI        | Casualidad (cambio de tarifa y precio se compensan) |

**Impacto critico**: La tasa de cobranza aparece como 73.3% cuando realmente fue 91.7%. Un dueno veria esto y pensaria que en enero cobraron pesimo, cuando en realidad cobraron muy bien. La ocupacion aparece MENOR (75% vs 80% real) pese a tener mas alumnos ahora — porque la capacidad tambien cambio.

---

## Caso 3: Tab "Optimizacion" — Consultar Enero desde Marzo

### Puntaje real de Enero

| Dimension        | Calculo real                                           | Puntaje |
|------------------|--------------------------------------------------------|---------|
| Rentabilidad     | Margen ponderado ~56% (ambos grupos rentables)         | 35 / 35 |
| Ocupacion        | 20/25 = 80%                                            | 31 / 35 |
| Eficiencia       | Costos/Ingresos = ($45.032+$95.000)/$370.000 = 37.8%  | 10 / 10 |
| Ganancias        | EBITDA margin = $229.968/$370.000 = 62.2%              | 20 / 20 |
| **TOTAL**        |                                                        | **96 / 100 — Saludable** |

### Lo que muestra el sistema (Enero visto desde Marzo)

| Dimension        | Calculo con datos actuales                              | Puntaje |
|------------------|---------------------------------------------------------|---------|
| Rentabilidad     | Margen ponderado ~52% (Martin cuesta mas)               | 35 / 35 |
| Ocupacion        | 22/30 = 73.3% (alumnos y capacidad actuales)            | 29 / 35 |
| Eficiencia       | ($48.496+$105.000)/$370.000 = 41.5%                    | 9 / 10  |
| Ganancias        | $216.504/$370.000 = 58.5%                               | 20 / 20 |
| **TOTAL**        |                                                         | **93 / 100 — Saludable** |

**Impacto**: 3 puntos de diferencia. En este caso el label no cambia, pero si el gimnasio estuviera cerca de un umbral (ej: 80 puntos), la diferencia podria cambiar la clasificacion de "Saludable" a "En desarrollo" — generando una alarma falsa o escondiendo un problema real.

---

## Caso extremo: Grupo nuevo que no existia

Si en marzo se crea un grupo "Acrobatica" con 5 alumnos, al consultar enero:

- El grupo Acrobatica aparece en las metricas de enero **con 5 alumnos y $0 cobrados**
- La tasa de cobranza del grupo es 0% — como si existiera y nadie hubiera pagado
- Distorsiona las metricas agregadas del gimnasio (baja la ocupacion general, sube el costo total)

**Ese grupo no existia en enero.** No deberia aparecer.

---

## Datos que se necesitan para el snapshot mensual

Solo hay que guardar lo que no se puede reconstruir despues:

| Dato                          | Por que se pierde                              |
|-------------------------------|------------------------------------------------|
| Alumnos activos por grupo     | Al cambiar status no queda registro por periodo |
| Capacidad maxima por grupo    | Se sobreescribe                                |
| Precio mensual por grupo      | Se sobreescribe                                |
| Costo de profesores por grupo | Tarifa y horarios se sobreescriben             |
| Gastos fijos totales del gym  | Se modifican/eliminan sin historial            |

Los pagos (cobrados, pendientes, montos) NO necesitan snapshot — ya estan en la DB con periodo.

---

## Propuesta de solucion

1. **Snapshot mensual automatico**: Al cierre de cada mes, guardar los datos de estructura por grupo + gastos fijos.
2. **Consulta historica**: Cuando se pide un mes pasado, usar el snapshot para estructura + pagos reales de la DB.
3. **Mes actual**: Calcular en vivo como hoy (sin cambios).
4. **Invalidacion**: Si se modifica un pago de un periodo pasado, regenerar el snapshot de ese periodo.
5. **Tab Optimizacion**: Convertir a current-only (sin selector de periodo) — mide el estado actual del gimnasio.
