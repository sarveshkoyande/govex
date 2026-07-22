-- AlterTable
ALTER TABLE "Tracker" ADD COLUMN     "driveLastSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DriveSyncConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,

    CONSTRAINT "DriveSyncConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriveSyncConfig_orgId_key" ON "DriveSyncConfig"("orgId");

-- AddForeignKey
ALTER TABLE "DriveSyncConfig" ADD CONSTRAINT "DriveSyncConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
