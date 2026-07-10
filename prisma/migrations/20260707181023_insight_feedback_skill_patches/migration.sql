-- CreateTable
CREATE TABLE "InsightFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InsightFeedback_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillPatchProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "currentContent" TEXT NOT NULL,
    "proposedContent" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "sourceFeedbackId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    CONSTRAINT "SkillPatchProposal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "autoApproveSkillPatches" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Organization" ("createdAt", "id", "name", "slug", "updatedAt") SELECT "createdAt", "id", "name", "slug", "updatedAt" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InsightFeedback_orgId_idx" ON "InsightFeedback"("orgId");

-- CreateIndex
CREATE INDEX "InsightFeedback_insightType_insightId_idx" ON "InsightFeedback"("insightType", "insightId");

-- CreateIndex
CREATE INDEX "SkillPatchProposal_orgId_idx" ON "SkillPatchProposal"("orgId");
