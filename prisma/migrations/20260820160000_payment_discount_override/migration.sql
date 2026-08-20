-- AlterTable: decisión manual del operario sobre el descuento de una cuota.
-- NULL = automático, que es como se venían comportando todas las cuotas.
ALTER TABLE "Payment" ADD COLUMN "discountOverride" BOOLEAN;
