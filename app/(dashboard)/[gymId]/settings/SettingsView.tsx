"use client"

import { PageHeader } from "@/components/ui/PageHeader"
import { PaymentMethodsSettings } from "./PaymentMethodsSettings"
import { LateFeeSettings } from "./LateFeeSettings"

/**
 * Configuración del gimnasio. Cada sección guarda por su cuenta contra su propio
 * endpoint: son reglas independientes y no tiene sentido que un error en una
 * bloquee a la otra.
 */
export default function SettingsView({ gymId }: { gymId: string }) {
  return (
    <div className="space-y-8">
      <PageHeader title="Configuración" subtitle="Reglas de cobro del gimnasio" />
      <PaymentMethodsSettings gymId={gymId} />
      <div className="border-t border-[#E5E4E0]" />
      <LateFeeSettings gymId={gymId} />
    </div>
  )
}
