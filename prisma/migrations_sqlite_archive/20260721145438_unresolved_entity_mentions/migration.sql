-- AlterTable
ALTER TABLE "EntityMention" ADD COLUMN "trackerId" TEXT;

-- CreateTable
CREATE TABLE "DismissedEntityCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DismissedEntityCandidate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DismissedEntityCandidate_orgId_idx" ON "DismissedEntityCandidate"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "DismissedEntityCandidate_trackerId_term_key" ON "DismissedEntityCandidate"("trackerId", "term");

-- CreateIndex
CREATE INDEX "EntityMention_trackerId_targetType_idx" ON "EntityMention"("trackerId", "targetType");
