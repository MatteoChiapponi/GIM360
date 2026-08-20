import { db } from "@/lib/db"
import { PaymentAdjustmentType, type PaymentMethod } from "@/app/generated/prisma/client"
import { adjustedAmount, methodAdjustment, type AdjustmentType, type PaymentMethodValue } from "@/lib/payment-methods"
import { PAYMENT_METHODS, type PaymentMethodConfigInput } from "./payment-methods.schema"

// `lib/payment-methods` no puede importar el cliente de Prisma (lo consumen
// componentes "use client"), así que declara los mismos valores a mano. Si algún
// día los enums se separan, estos alias dejan de compilar.
type _SameAdjustmentTypes = AdjustmentType extends PaymentAdjustmentType ? PaymentAdjustmentType extends AdjustmentType ? true : never : never
type _SameMethods = PaymentMethodValue extends PaymentMethod ? PaymentMethod extends PaymentMethodValue ? true : never : never

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

/**
 * Filas iniciales de un gimnasio nuevo: los tres medios habilitados y sin ajuste.
 * Se crean explícitamente al dar de alta el gimnasio para que la config exista
 * desde el día cero (los gimnasios anteriores quedaron cargados por migración).
 */
export function initialPaymentMethodConfigs() {
  return PAYMENT_METHODS.map((method) => ({
    method,
    enabled: true,
    adjustmentType: PaymentAdjustmentType.NONE,
    adjustmentPercent: 0,
  }))
}

/**
 * Devuelve los tres medios de pago del gimnasio, completando con los defaults
 * los que no tengan fila. Lo normal es que las tres existan; el fallback cubre
 * cualquier gimnasio cargado por fuera del alta (una inserción a mano, un restore).
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
 * La fórmula vive en `lib/payment-methods` para que el backend y la vista
 * previa del cliente no puedan calcular cosas distintas.
 */
export function applyMethodAdjustment(
  baseAmount: number,
  config: Pick<PaymentMethodConfig, "adjustmentType" | "adjustmentPercent">,
): { amount: number; adjustment: number } {
  return {
    amount: adjustedAmount(baseAmount, config),
    adjustment: methodAdjustment(baseAmount, config),
  }
}
