-- CreateEnum
CREATE TYPE "LateFeeType" AS ENUM ('FIXED', 'PERCENT');

-- CreateEnum
CREATE TYPE "LateFeeFrequency" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "lateFee" DECIMAL(10,2),
ADD COLUMN     "lateDays" INTEGER,
ADD COLUMN     "lateFeeWaived" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "lateFeeExempt" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LateFeeConfig" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "feeType" "LateFeeType" NOT NULL DEFAULT 'PERCENT',
    "feeValue" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "frequency" "LateFeeFrequency" NOT NULL DEFAULT 'ONCE',
    "maxFeeAmount" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LateFeeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LateFeeConfig_gymId_key" ON "LateFeeConfig"("gymId");

-- AddForeignKey
ALTER TABLE "LateFeeConfig" ADD CONSTRAINT "LateFeeConfig_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
