-- CreateTable
CREATE TABLE "Receptionist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receptionist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Receptionist_userId_key" ON "Receptionist"("userId");

-- CreateIndex
CREATE INDEX "Receptionist_gymId_idx" ON "Receptionist"("gymId");

-- AddForeignKey
ALTER TABLE "Receptionist" ADD CONSTRAINT "Receptionist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receptionist" ADD CONSTRAINT "Receptionist_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
