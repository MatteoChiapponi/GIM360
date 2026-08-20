-- CreateEnum
CREATE TYPE "PaymentAdjustmentType" AS ENUM ('NONE', 'SURCHARGE', 'DISCOUNT');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "baseAmount" DECIMAL(10,2),
ADD COLUMN     "methodAdjustment" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "PaymentMethodConfig" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "adjustmentType" "PaymentAdjustmentType" NOT NULL DEFAULT 'NONE',
    "adjustmentPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentMethodConfig_gymId_idx" ON "PaymentMethodConfig"("gymId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethodConfig_gymId_method_key" ON "PaymentMethodConfig"("gymId", "method");

-- AddForeignKey
ALTER TABLE "PaymentMethodConfig" ADD CONSTRAINT "PaymentMethodConfig_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
