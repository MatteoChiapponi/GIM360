import { db } from "@/lib/db"
import type { LateFeeType } from "@/app/generated/prisma/client"
import {
  DEFAULT_LATE_FEE_CONFIG,
  computeLateFee,
  lateDaysAt,
  type LateFeeConfig,
  type LateFeeTypeValue,
} from "@/lib/late-fee"
import type { UpdateLateFeeConfigInput } from "./late-fees.schema"

// `lib/late-fee` no puede importar el cliente de Prisma (lo consumen componentes
// "use client"), así que declara los mismos valores a mano. Si algún día el enum
// se separa, este alias deja de compilar.
type _SameFeeTypes = LateFeeTypeValue extends LateFeeType ? (LateFeeType extends LateFeeTypeValue ? true : never) : never

/**
 * Regla de mora del gimnasio. Sin fila configurada devuelve el default, que es
 * la regla apagada: el comportamiento con el que venían todos los gimnasios.
 */
export async function getLateFeeConfig(gymId: string): Promise<LateFeeConfig> {
  const row = await db.lateFeeConfig.findFirst({ where: { gymId } })
  if (!row) return DEFAULT_LATE_FEE_CONFIG

  return {
    enabled: row.enabled,
    graceDays: row.graceDays,
    feeType: row.feeType,
    feeValue: Number(row.feeValue),
    repeatEveryDays: row.repeatEveryDays,
    maxCharges: row.maxCharges,
    maxFeeAmount: row.maxFeeAmount === null ? null : Number(row.maxFeeAmount),
  }
}

/** Guarda la regla del gimnasio (la crea si todavía no existía). */
export async function updateLateFeeConfig(
  gymId: string,
  data: Omit<UpdateLateFeeConfigInput, "gymId">,
): Promise<LateFeeConfig> {
  await db.lateFeeConfig.upsert({
    where: { gymId },
    create: { gymId, ...data },
    update: data,
  })

  return getLateFeeConfig(gymId)
}

/**
 * Recargo por mora de una cuota impaga al momento `at`.
 * La fórmula vive en `lib/late-fee` para que la vista previa del cliente y el
 * cobro del backend no puedan calcular cosas distintas.
 */
export function lateFeeFor(
  baseAmount: number,
  period: string | Date,
  dueDay: number,
  config: LateFeeConfig,
  at: Date = new Date(),
): { fee: number; lateDays: number } {
  const lateDays = lateDaysAt(period, dueDay, at)
  return { fee: computeLateFee(baseAmount, lateDays, config), lateDays }
}
