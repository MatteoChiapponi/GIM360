-- Descuentos del gimnasio, su asignación a alumnos y lo que la cuota guarda de
-- ellos. Va después de las migraciones de medios de pago y mora: el `baseAmount`
-- que ya existe en Payment es la cuota limpia congelada al cobrar, distinto del
-- `listAmount` que se agrega acá (el precio de lista de los grupos).

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_PRICE');

-- CreateTable
CREATE TABLE "Discount" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "loseOnLatePayment" BOOLEAN NOT NULL DEFAULT false,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDiscount" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "discountId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Discount_gymId_idx" ON "Discount"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "Discount_gymId_name_key" ON "Discount"("gymId", "name");

-- CreateIndex
CREATE INDEX "StudentDiscount_studentId_idx" ON "StudentDiscount"("studentId");

-- CreateIndex
CREATE INDEX "StudentDiscount_discountId_idx" ON "StudentDiscount"("discountId");

-- AlterTable: el precio de la cuota, que se define al generarla.
-- `listAmount` arranca en la cuota limpia que ya tenía cada pago: el `baseAmount`
-- congelado al cobrar si existe, y si no el `amount`. Las cuotas viejas no
-- tenían descuento, así que `amount` = `listAmount` para ellas.
ALTER TABLE "Payment" ADD COLUMN "listAmount" DECIMAL(10,2);
UPDATE "Payment" SET "listAmount" = COALESCE("baseAmount", "amount") WHERE "listAmount" IS NULL;
ALTER TABLE "Payment" ALTER COLUMN "listAmount" SET NOT NULL;

ALTER TABLE "Payment" ADD COLUMN "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "discountId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "discountName" TEXT;
-- Decisión manual sobre el descuento: NULL = automático.
ALTER TABLE "Payment" ADD COLUMN "discountOverride" BOOLEAN;

-- CreateIndex
CREATE INDEX "Payment_discountId_idx" ON "Payment"("discountId");

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDiscount" ADD CONSTRAINT "StudentDiscount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDiscount" ADD CONSTRAINT "StudentDiscount_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
