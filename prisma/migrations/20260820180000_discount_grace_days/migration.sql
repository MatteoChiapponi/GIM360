-- AlterTable: días de gracia antes de perder el descuento por pago fuera de término.
-- Default 0: se pierde el mismo día que vence la cuota, que es como venía funcionando.
ALTER TABLE "Discount" ADD COLUMN "graceDays" INTEGER NOT NULL DEFAULT 0;
