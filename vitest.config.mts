import { defineConfig } from "vitest/config"

// Los tests corren en la misma zona que producción (`instrumentation.ts` la
// fija en Argentina), así que una fecha que pasa acá pasa en el servidor.
// `tests/timezone.test.ts` es el único que la mueve, justamente para probar
// que los helpers de `lib/timezone` no dependen de ella.
process.env.TZ = "America/Argentina/Buenos_Aires"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    mockReset: true,
    env: { TZ: "America/Argentina/Buenos_Aires" },
  },
})
