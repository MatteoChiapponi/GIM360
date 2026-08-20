import { z } from "zod"
import { LateFeeType } from "@/app/generated/prisma/client"

export const updateLateFeeConfigSchema = z
  .object({
    gymId: z.string().min(1),
    enabled: z.boolean(),
    /** Días de tolerancia después del vencimiento. 0 = corre desde el día siguiente. */
    graceDays: z.number().int().min(0).max(365),
    feeType: z.nativeEnum(LateFeeType),
    feeValue: z.number().min(0).multipleOf(0.01),
    /** Cada cuántos días se repite mientras siga impaga. `null` = una sola vez. */
    repeatEveryDays: z.number().int().min(1).max(365).nullable(),
    /** Tope de aplicaciones. `null` = sin tope. */
    maxCharges: z.number().int().min(1).max(365).nullable(),
    /** Tope del recargo acumulado, en pesos. `null` = sin tope. */
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
  .refine((c) => c.repeatEveryDays !== null || c.maxCharges === null, {
    message: "Un recargo por única vez no lleva tope de aplicaciones",
    path: ["maxCharges"],
  })

export type UpdateLateFeeConfigInput = z.infer<typeof updateLateFeeConfigSchema>
