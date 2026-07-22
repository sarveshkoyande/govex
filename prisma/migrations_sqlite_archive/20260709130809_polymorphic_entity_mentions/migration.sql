/*
  Warnings:

  - You are about to drop the column `sourceEventId` on the `EntityMention` table. All the data in the column will be lost.
  - Added the required column `sourceId` to the `EntityMention` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceType` to the `EntityMention` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EntityMention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetTerm" TEXT,
    "method" TEXT NOT NULL,
    "contextSnippet" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "reasoning" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntityMention_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EntityMention" ("confidence", "contextSnippet", "createdAt", "id", "method", "orgId", "reasoning", "targetId", "targetTerm", "targetType") SELECT "confidence", "contextSnippet", "createdAt", "id", "method", "orgId", "reasoning", "targetId", "targetTerm", "targetType" FROM "EntityMention";
DROP TABLE "EntityMention";
ALTER TABLE "new_EntityMention" RENAME TO "EntityMention";
CREATE INDEX "EntityMention_orgId_idx" ON "EntityMention"("orgId");
CREATE INDEX "EntityMention_sourceType_sourceId_idx" ON "EntityMention"("sourceType", "sourceId");
CREATE INDEX "EntityMention_targetType_targetId_idx" ON "EntityMention"("targetType", "targetId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
