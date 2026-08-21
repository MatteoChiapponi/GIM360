import { vi } from "vitest"

/**
 * Fake mínimo de Prisma para los tests.
 *
 * No pretende ser un ORM: implementa `findFirst` / `findMany` sobre arrays en
 * memoria, que es todo lo que usa `modules/belongs`. La gracia es que los
 * belongs corren de verdad contra estos datos, así que los tests de acceso
 * prueban la cadena completa (rol → belongs → handler) y no una versión
 * mockeada de sí misma.
 *
 * El resto de los métodos son `vi.fn()`: los servicios de dominio se mockean
 * aparte, no son lo que se está probando acá.
 */

export type Row = Record<string, unknown>

/** Match recursivo del `where` contra una fila. Soporta filtros de relación. */
export function matchesWhere(row: Row | undefined, where: Row): boolean {
  if (!row) return false

  return Object.entries(where).every(([key, expected]) => {
    if (expected === undefined) return true

    const actual = row[key]

    // Filtro anidado por relación, ej. { owner: { userId } }
    if (expected !== null && typeof expected === "object" && !Array.isArray(expected)) {
      return matchesWhere(actual as Row | undefined, expected as Row)
    }

    return actual === expected
  })
}

function table(rows: Row[] = []) {
  const state = { rows }

  return {
    /** Reemplaza el contenido de la tabla (para el fixture de cada test). */
    __seed(next: Row[]) {
      state.rows = next
    },
    __rows() {
      return state.rows
    },
    findFirst: vi.fn(async ({ where }: { where: Row }) => state.rows.find((r) => matchesWhere(r, where)) ?? null),
    findUnique: vi.fn(async ({ where }: { where: Row }) => state.rows.find((r) => matchesWhere(r, where)) ?? null),
    findMany: vi.fn(async ({ where }: { where?: Row } = {}) =>
      where ? state.rows.filter((r) => matchesWhere(r, where)) : state.rows,
    ),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  }
}

export const db = {
  user: table(),
  owner: table(),
  gym: table(),
  trainer: table(),
  receptionist: table(),
  student: table(),
  group: table(),
  trainerGroup: table(),
  studentGroup: table(),
  schedule: table(),
  payment: table(),
  fixedExpense: table(),
  cashClosing: table(),
  attendance: table(),
  studentFile: table(),
  discount: table(),
  studentDiscount: table(),
  $transaction: vi.fn(),
}

const TABLES = Object.keys(db).filter((k) => k !== "$transaction") as (keyof typeof db)[]

/** Vacía todas las tablas y reinstala el comportamiento de `$transaction`. */
export function resetDb() {
  for (const name of TABLES) {
    const t = db[name] as ReturnType<typeof table>
    t.__seed([])
  }

  db.$transaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: typeof db) => unknown)(db) : Promise.all(arg as unknown[]),
  )
}

/** Carga filas en una tabla. */
export function seed(name: Exclude<keyof typeof db, "$transaction">, rows: Row[]) {
  ;(db[name] as ReturnType<typeof table>).__seed(rows)
}
