import { z } from "zod"
import { PaymentMethod, PaymentAdjustmentType } from "@/app/generated/prisma/client"

/** Los tres medios de pago, en el orden en que se muestran. */
export const PAYMENT_METHODS = [
  PaymentMethod.CASH,
  PaymentMethod.TRANSFER,
  PaymentMethod.CARD,
] as const

export const paymentMethodConfigSchema = z
  .object({
    method: z.nativeEnum(PaymentMethod),
    enabled: z.boolean(),
    adjustmentType: z.nativeEnum(PaymentAdjustmentType),
    adjustmentPercent: z.number().min(0).max(100).multipleOf(0.01),
  })
  .refine(
    (c) => (c.adjustmentType === PaymentAdjustmentType.NONE ? c.adjustmentPercent === 0 : c.adjustmentPercent > 0),
    { message: "Un recargo o descuento debe tener un porcentaje mayor a 0", path: ["adjustmentPercent"] },
  )

export const updatePaymentMethodConfigsSchema = z
  .object({
    gymId: z.string().min(1),
    configs: z.array(paymentMethodConfigSchema).min(1).max(PAYMENT_METHODS.length),
  })
  .refine((d) => new Set(d.configs.map((c) => c.method)).size === d.configs.length, {
    message: "No se puede repetir el mismo medio de pago",
    path: ["configs"],
  })
  .refine((d) => d.configs.some((c) => c.enabled), {
    message: "Tiene que quedar al menos un medio de pago habilitado",
    path: ["configs"],
  })

export type PaymentMethodConfigInput = z.infer<typeof paymentMethodConfigSchema>
export type UpdatePaymentMethodConfigsInput = z.infer<typeof updatePaymentMethodConfigsSchema>
