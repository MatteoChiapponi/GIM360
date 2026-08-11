import { beforeEach, vi } from "vitest"

// Variables que algunos módulos leen al importarse.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test"
process.env.AUTH_SECRET ??= "test-secret"
process.env.SUPABASE_URL ??= "https://test.supabase.co"
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key"

// El logger escribe en consola en cada request; en los tests solo hace ruido.
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(async () => {
  const { resetDb } = await import("./mocks/db")
  resetDb()
})
