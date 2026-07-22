-- CreateTable
CREATE TABLE "DriveSyncedFile" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "driveFileId" TEXT NOT NULL,
    "driveModifiedAt" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveSyncedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriveSyncedFile_orgId_idx" ON "DriveSyncedFile"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "DriveSyncedFile_trackerId_driveFileId_key" ON "DriveSyncedFile"("trackerId", "driveFileId");

-- AddForeignKey
ALTER TABLE "DriveSyncedFile" ADD CONSTRAINT "DriveSyncedFile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriveSyncedFile" ADD CONSTRAINT "DriveSyncedFile_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
