import { z } from "zod"

/** Shared query-param schema used by all metrics endpoints */
export const metricsQuerySchema = z.object({
  gymId: z.string().cuid(),
  period: z.string().regex(/^\d{4}-\d{2}$/, "period must be YYYY-MM"),
})

export type MetricsQueryInput = z.infer<typeof metricsQuerySchema>
