import { z } from "zod"
import { DiscountType } from "@/app/generated/prisma/client"

const periodSchema = z.string().regex(/^\d{4}-\d{2}$/, "El período debe tener formato YYYY-MM")

const baseDiscountSchema = z.object({
  gymId: z.string().min(1),
  name: z.string().min(1).max(60),
  description: z.string().max(200).nullable().optional(),
  type: z.nativeEnum(DiscountType),
  value: z.number().positive().multipleOf(0.01),
  active: z.boolean().optional(),
  loseOnLatePayment: z.boolean().optional(),
  graceDays: z.number().int().min(0).max(60).optional(),
})

/** Un porcentaje mayor a 100 dejaría la cuota en cero y confundiría al dueño:
 *  para "no paga" está el 100%. */
function valueFitsType(data: { type: DiscountType; value?: number }) {
  if (data.type !== DiscountType.PERCENTAGE || data.value === undefined) return true
  return data.value <= 100
}
const PERCENTAGE_ERROR = {
  message: "Un descuento porcentual no puede superar el 100%",
  path: ["value"],
}

export const createDiscountSchema = baseDiscountSchema.refine(valueFitsType, PERCENTAGE_ERROR)

export const updateDiscountSchema = baseDiscountSchema
  .omit({ gymId: true })
  .partial()
  .refine((data) => data.type === undefined || valueFitsType({ type: data.type, value: data.value }), PERCENTAGE_ERROR)

export const assignDiscountSchema = z.object({
  discountId: z.string().min(1),
  /** Primer período en el que se aplica. Por defecto, el mes en curso. */
  validFrom: periodSchema.optional(),
  /** Último período en el que se aplica; null = sin fecha de corte. */
  validUntil: periodSchema.nullable().optional(),
  notes: z.string().max(200).nullable().optional(),
})

export const updateAssignmentSchema = z.object({
  validFrom: periodSchema.optional(),
  validUntil: periodSchema.nullable().optional(),
  notes: z.string().max(200).nullable().optional(),
})

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>
export type AssignDiscountInput = z.infer<typeof assignDiscountSchema>
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>
