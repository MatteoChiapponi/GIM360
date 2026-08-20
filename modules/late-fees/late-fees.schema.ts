import { z } from "zod"
import { LateFeeType, LateFeeFrequency } from "@/app/generated/prisma/client"

export const updateLateFeeConfigSchema = z
  .object({
    gymId: z.string().min(1),
    enabled: z.boolean(),
    /** Días de tolerancia después del vencimiento. 0 = corre desde el día siguiente. */
    graceDays: z.number().int().min(0).max(365),
    feeType: z.nativeEnum(LateFeeType),
    feeValue: z.number().min(0).multipleOf(0.01),
    frequency: z.nativeEnum(LateFeeFrequency),
    maxFeeAmount: z.number().positive().multipleOf(0.01).nullable(),
  })
  .refine((c) => !c.enabled || c.feeValue > 0, {
    message: "El recargo tiene que ser mayor a 0",
    path: ["feeValue"],
  })
  .refine((c) => c.feeType !== LateFeeType.PERCENT || c.feeValue <= 100, {
    message: "El porcentaje no puede superar el 100%",
    path: ["feeValue"],
  })

export type UpdateLateFeeConfigInput = z.infer<typeof updateLateFeeConfigSchema>
