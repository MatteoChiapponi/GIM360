import { describe, it, expect, afterAll } from "vitest"
import {
  TIMEZONE,
  addDays,
  argentinaDate,
  argentinaParts,
  currentPeriod,
  daysInMonth,
  endOfDay,
  formatDate,
  formatMonthYear,
  fromISODate,
  isSameDay,
  startOfDay,
  toArgentinaISOString,
  toISODate,
  toPeriod,
  todayISO,
  weekday,
  weekdayName,
} from "@/lib/timezone"
import { dueDateFor, lateDaysAt } from "@/lib/late-fee"

/**
 * El servidor de producción está en Estados Unidos. `instrumentation.ts` le
 * pone la zona de Argentina al proceso, pero eso no cubre al navegador, así que
 * los helpers tienen que dar lo mismo corran donde corran.
 *
 * Estos tests mueven `process.env.TZ` a propósito —Node relee la variable al
 * asignarla— y verifican que la respuesta no cambie. Es el único archivo que la
 * toca; el resto corre en Argentina, igual que producción.
 */

const ORIGINAL_TZ = process.env.TZ
const ZONES = ["America/Argentina/Buenos_Aires", "America/Los_Angeles", "UTC", "Asia/Tokyo"]

/** Corre el caso en varias zonas de runtime y exige el mismo resultado en todas. */
function inEveryZone(run: () => void) {
  for (const tz of ZONES) {
    process.env.TZ = tz
    try {
      run()
    } catch (err) {
      throw new Error(`Falla con TZ=${tz}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}

afterAll(() => {
  process.env.TZ = ORIGINAL_TZ
})

// 2026-08-21 01:30 UTC = 2026-08-20 22:30 en Buenos Aires. La noche argentina
// es donde se rompe todo: para el servidor en Estados Unidos ya es el día 20 a
// la tarde, y para UTC ya es el 21.
const NIGHT = new Date("2026-08-21T01:30:00Z")
// 2026-08-20 02:00 UTC = 2026-08-19 23:00 en Buenos Aires: el otro borde.
const EARLY = new Date("2026-08-20T02:00:00Z")

describe("lib/timezone", () => {
  it("la zona del proyecto es Buenos Aires", () => {
    expect(TIMEZONE).toBe("America/Argentina/Buenos_Aires")
  })

  it("parte un instante en la hora de pared argentina", () => {
    inEveryZone(() => {
      expect(argentinaParts(NIGHT)).toEqual({
        year: 2026, month: 8, day: 20, hour: 22, minute: 30, second: 0, weekday: 4,
      })
    })
  })

  it("el día es el argentino, no el del runtime", () => {
    inEveryZone(() => {
      expect(toISODate(NIGHT)).toBe("2026-08-20")
      expect(toISODate(EARLY)).toBe("2026-08-19")
      expect(toPeriod(NIGHT)).toBe("2026-08")
      expect(weekday(NIGHT)).toBe(4)
      expect(weekdayName(NIGHT)).toBe("THURSDAY")
    })
  })

  it("el último día del mes a la noche sigue siendo de ese mes", () => {
    // 2026-09-01 01:00 UTC = 2026-08-31 22:00 en Argentina.
    const lastNight = new Date("2026-09-01T01:00:00Z")
    inEveryZone(() => {
      expect(toPeriod(lastNight)).toBe("2026-08")
      expect(toISODate(lastNight)).toBe("2026-08-31")
    })
  })

  it("arma la medianoche argentina de un día (UTC-3)", () => {
    inEveryZone(() => {
      expect(argentinaDate(2026, 8, 20).toISOString()).toBe("2026-08-20T03:00:00.000Z")
      expect(startOfDay(NIGHT).toISOString()).toBe("2026-08-20T03:00:00.000Z")
      expect(endOfDay(NIGHT).toISOString()).toBe("2026-08-21T02:59:59.999Z")
    })
  })

  it("fromISODate e toISODate son inversas", () => {
    inEveryZone(() => {
      for (const iso of ["2026-01-01", "2026-08-20", "2026-12-31", "2028-02-29"]) {
        expect(toISODate(fromISODate(iso))).toBe(iso)
      }
    })
  })

  it("normaliza meses y días fuera de rango", () => {
    inEveryZone(() => {
      expect(toISODate(argentinaDate(2026, 13, 1))).toBe("2027-01-01")
      expect(toISODate(argentinaDate(2026, 1, 0))).toBe("2025-12-31")
      expect(toISODate(argentinaDate(2026, 3, 0))).toBe("2026-02-28")
    })
  })

  it("addDays corre días argentinos, no bloques de 24 h del runtime", () => {
    inEveryZone(() => {
      expect(toISODate(addDays(NIGHT, 1))).toBe("2026-08-21")
      expect(toISODate(addDays(NIGHT, -1))).toBe("2026-08-19")
      expect(toISODate(addDays(fromISODate("2026-12-31"), 1))).toBe("2027-01-01")
    })
  })

  it("daysInMonth conoce los bisiestos", () => {
    inEveryZone(() => {
      expect(daysInMonth(2026, 2)).toBe(28)
      expect(daysInMonth(2028, 2)).toBe(29)
      expect(daysInMonth(2026, 8)).toBe(31)
      expect(daysInMonth(2026, 4)).toBe(30)
    })
  })

  it("isSameDay compara días argentinos", () => {
    inEveryZone(() => {
      // Las dos son del 20 en Argentina, pero de días distintos en UTC.
      expect(isSameDay(new Date("2026-08-20T15:00:00Z"), NIGHT)).toBe(true)
      expect(isSameDay(EARLY, NIGHT)).toBe(false)
    })
  })

  it("formatea con la zona de Argentina", () => {
    inEveryZone(() => {
      expect(formatDate(NIGHT)).toBe("20/8/2026")
      expect(formatMonthYear("2026-08")).toBe("agosto de 2026")
      expect(formatMonthYear(NIGHT)).toBe("agosto de 2026")
    })
  })

  it("toArgentinaISOString lleva el offset -03:00", () => {
    inEveryZone(() => {
      expect(toArgentinaISOString(NIGHT)).toBe("2026-08-20T22:30:00.000-03:00")
      // Sigue siendo el mismo instante.
      expect(new Date(toArgentinaISOString(NIGHT)).getTime()).toBe(NIGHT.getTime())
    })
  })

  it("todayISO y currentPeriod son coherentes entre sí", () => {
    inEveryZone(() => {
      expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(currentPeriod()).toBe(todayISO().slice(0, 7))
    })
  })
})

describe("vencimientos con la zona de Argentina", () => {
  it("la cuota vence a la medianoche argentina del dueDay", () => {
    inEveryZone(() => {
      expect(dueDateFor("2026-08", 10).toISOString()).toBe("2026-08-10T03:00:00.000Z")
      // dueDay 31 en un mes corto se recorta al último día.
      expect(dueDateFor("2026-02", 31).toISOString()).toBe("2026-02-28T03:00:00.000Z")
      expect(dueDateFor("2028-02", 31).toISOString()).toBe("2028-02-29T03:00:00.000Z")
    })
  })

  it("el alumno tiene todo el día del vencimiento, en hora argentina", () => {
    // 23:30 del día 10 en Argentina: todavía no debe nada.
    const stillOnTime = new Date("2026-08-11T02:30:00Z")
    // 00:30 del día 11 en Argentina: ya debe un día.
    const justLate = new Date("2026-08-11T03:30:00Z")

    inEveryZone(() => {
      expect(lateDaysAt("2026-08", 10, stillOnTime)).toBe(0)
      expect(lateDaysAt("2026-08", 10, justLate)).toBe(1)
    })
  })

  it("no cuenta atraso antes del vencimiento", () => {
    inEveryZone(() => {
      expect(lateDaysAt("2026-08", 10, new Date("2026-08-05T12:00:00Z"))).toBe(0)
      expect(lateDaysAt("2026-08", 10, new Date("2026-08-20T12:00:00Z"))).toBe(10)
    })
  })
})
