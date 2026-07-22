-- CreateTable
CREATE TABLE "CustomSkill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomSkill_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SkillPatchProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "currentContent" TEXT NOT NULL,
    "proposedContent" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "sourceFeedbackId" TEXT,
    "isNewSkill" BOOLEAN NOT NULL DEFAULT false,
    "targetIsCustom" BOOLEAN NOT NULL DEFAULT false,
    "newSkillTitle" TEXT,
    "newSkillDescription" TEXT,
    "newSkillCategory" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    CONSTRAINT "SkillPatchProposal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SkillPatchProposal" ("createdAt", "currentContent", "id", "orgId", "proposedContent", "reasoning", "reviewedAt", "reviewedBy", "skillName", "sourceFeedbackId", "status") SELECT "createdAt", "currentContent", "id", "orgId", "proposedContent", "reasoning", "reviewedAt", "reviewedBy", "skillName", "sourceFeedbackId", "status" FROM "SkillPatchProposal";
DROP TABLE "SkillPatchProposal";
ALTER TABLE "new_SkillPatchProposal" RENAME TO "SkillPatchProposal";
CREATE INDEX "SkillPatchProposal_orgId_idx" ON "SkillPatchProposal"("orgId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CustomSkill_orgId_idx" ON "CustomSkill"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomSkill_orgId_name_key" ON "CustomSkill"("orgId", "name");
