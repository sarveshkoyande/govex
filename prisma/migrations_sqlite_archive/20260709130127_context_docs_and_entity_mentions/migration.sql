-- CreateTable
CREATE TABLE "EntityMention" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetTerm" TEXT,
    "method" TEXT NOT NULL,
    "contextSnippet" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "reasoning" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EntityMention_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "RawIngestionEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EntityMention_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RawIngestionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT,
    "domainId" TEXT,
    "apiKeyId" TEXT,
    "source" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "subject" TEXT,
    "fromAddress" TEXT,
    "participants" TEXT,
    "occurredAt" DATETIME NOT NULL,
    "rawText" TEXT NOT NULL,
    "rawPayload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "ingestedVia" TEXT NOT NULL DEFAULT 'webhook',
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawIngestionEvent_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RawIngestionEvent_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RawIngestionEvent_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "IngestionApiKey" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RawIngestionEvent" ("apiKeyId", "createdAt", "fromAddress", "id", "ingestedVia", "occurredAt", "participants", "rawPayload", "rawText", "source", "sourceSystem", "status", "subject", "summary", "trackerId") SELECT "apiKeyId", "createdAt", "fromAddress", "id", "ingestedVia", "occurredAt", "participants", "rawPayload", "rawText", "source", "sourceSystem", "status", "subject", "summary", "trackerId" FROM "RawIngestionEvent";
DROP TABLE "RawIngestionEvent";
ALTER TABLE "new_RawIngestionEvent" RENAME TO "RawIngestionEvent";
CREATE INDEX "RawIngestionEvent_trackerId_idx" ON "RawIngestionEvent"("trackerId");
CREATE INDEX "RawIngestionEvent_domainId_idx" ON "RawIngestionEvent"("domainId");
CREATE INDEX "RawIngestionEvent_apiKeyId_idx" ON "RawIngestionEvent"("apiKeyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EntityMention_orgId_idx" ON "EntityMention"("orgId");

-- CreateIndex
CREATE INDEX "EntityMention_sourceEventId_idx" ON "EntityMention"("sourceEventId");

-- CreateIndex
CREATE INDEX "EntityMention_targetType_targetId_idx" ON "EntityMention"("targetType", "targetId");
