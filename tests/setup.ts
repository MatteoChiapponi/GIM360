import { beforeEach, vi } from "vitest"

// No hace falta ninguna variable de entorno: los módulos que las leen al
// importarse (`lib/db`, `lib/auth`, `lib/supabase-admin`) están mockeados en
// los tests que los usan, así que nunca se evalúan de verdad.

// El logger escribe en consola en cada request; en los tests solo hace ruido.
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(async () => {
  const { resetDb } = await import("./mocks/db")
  resetDb()
})
