import { db } from "@/lib/db"
import { PaymentAdjustmentType, type PaymentMethod } from "@/app/generated/prisma/client"
import { PAYMENT_METHODS, type PaymentMethodConfigInput } from "./payment-methods.schema"

/** Config de un medio de pago tal como la consume la app (percent ya como number). */
export type PaymentMethodConfig = {
  method: PaymentMethod
  enabled: boolean
  adjustmentType: PaymentAdjustmentType
  adjustmentPercent: number
}

/** Default de un medio de pago sin configurar: habilitado y sin ajuste. */
function defaultConfig(method: PaymentMethod): PaymentMethodConfig {
  return { method, enabled: true, adjustmentType: PaymentAdjustmentType.NONE, adjustmentPercent: 0 }
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Devuelve los tres medios de pago del gimnasio, completando con los defaults
 * los que todavía no tienen fila. No escribe: un gimnasio recién creado ya
 * responde con los tres habilitados sin necesidad de inicializarlo.
 */
export async function getPaymentMethodConfigs(gymId: string): Promise<PaymentMethodConfig[]> {
  const rows = await db.paymentMethodConfig.findMany({ where: { gymId } })

  return PAYMENT_METHODS.map((method) => {
    const row = rows.find((r) => r.method === method)
    if (!row) return defaultConfig(method)
    return {
      method,
      enabled: row.enabled,
      adjustmentType: row.adjustmentType,
      adjustmentPercent: Number(row.adjustmentPercent),
    }
  })
}

/** Devuelve la config de un solo medio de pago (default si no está configurado). */
export async function getPaymentMethodConfig(gymId: string, method: PaymentMethod): Promise<PaymentMethodConfig> {
  const row = await db.paymentMethodConfig.findFirst({ where: { gymId, method } })
  if (!row) return defaultConfig(method)
  return {
    method,
    enabled: row.enabled,
    adjustmentType: row.adjustmentType,
    adjustmentPercent: Number(row.adjustmentPercent),
  }
}

/** Guarda la config de uno o más medios de pago y devuelve los tres actualizados. */
export async function updatePaymentMethodConfigs(
  gymId: string,
  configs: PaymentMethodConfigInput[],
): Promise<PaymentMethodConfig[]> {
  await db.$transaction(
    configs.map((c) =>
      db.paymentMethodConfig.upsert({
        where: { gymId_method: { gymId, method: c.method } },
        create: {
          gymId,
          method: c.method,
          enabled: c.enabled,
          adjustmentType: c.adjustmentType,
          adjustmentPercent: c.adjustmentPercent,
        },
        update: {
          enabled: c.enabled,
          adjustmentType: c.adjustmentType,
          adjustmentPercent: c.adjustmentPercent,
        },
      }),
    ),
  )

  return getPaymentMethodConfigs(gymId)
}

/**
 * Aplica el recargo o descuento del medio de pago sobre el monto de la cuota.
 * `adjustment` va firmado: positivo si es recargo, negativo si es descuento.
 */
export function applyMethodAdjustment(
  baseAmount: number,
  config: Pick<PaymentMethodConfig, "adjustmentType" | "adjustmentPercent">,
): { amount: number; adjustment: number } {
  if (config.adjustmentType === PaymentAdjustmentType.NONE || config.adjustmentPercent === 0) {
    return { amount: round2(baseAmount), adjustment: 0 }
  }

  const delta = round2((baseAmount * config.adjustmentPercent) / 100)
  const adjustment = config.adjustmentType === PaymentAdjustmentType.DISCOUNT ? -delta : delta

  return { amount: Math.max(round2(baseAmount + adjustment), 0), adjustment }
}
