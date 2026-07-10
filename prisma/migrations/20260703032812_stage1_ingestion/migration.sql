-- CreateTable
CREATE TABLE "IngestionApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPreview" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "lastUsedAt" DATETIME,
    CONSTRAINT "IngestionApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RawIngestionEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawIngestionEvent_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RawIngestionEvent_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "IngestionApiKey" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestionApiKey_tokenHash_key" ON "IngestionApiKey"("tokenHash");

-- CreateIndex
CREATE INDEX "IngestionApiKey_orgId_idx" ON "IngestionApiKey"("orgId");

-- CreateIndex
CREATE INDEX "RawIngestionEvent_trackerId_idx" ON "RawIngestionEvent"("trackerId");

-- CreateIndex
CREATE INDEX "RawIngestionEvent_apiKeyId_idx" ON "RawIngestionEvent"("apiKeyId");
