-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "manualAdjustment" DECIMAL(10,2),
ADD COLUMN     "manualAdjustmentReason" TEXT;

-- AlterTable
ALTER TABLE "CashClosing" ADD COLUMN     "adjustmentsCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "adjustmentsTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;
