-- AlterTable: descuentos que se pierden si la cuota se paga vencida.
-- Default false: los descuentos existentes se siguen aplicando siempre.
ALTER TABLE "Discount" ADD COLUMN "loseOnLatePayment" BOOLEAN NOT NULL DEFAULT false;
