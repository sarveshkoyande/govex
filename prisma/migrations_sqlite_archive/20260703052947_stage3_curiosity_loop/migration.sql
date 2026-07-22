-- CreateTable
CREATE TABLE "OutboundWebhookConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT,
    "lastUsedAt" DATETIME,
    "lastStatus" TEXT,
    "lastError" TEXT,
    CONSTRAINT "OutboundWebhookConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OpenQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "stakeholderId" TEXT,
    "answerEventId" TEXT,
    "questionPattern" TEXT NOT NULL,
    "targetSummary" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "rationale" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 60,
    "source" TEXT NOT NULL DEFAULT 'GEMINI',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "deliveryStatus" TEXT,
    "deliveryError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "askedAt" DATETIME,
    "answeredAt" DATETIME,
    CONSTRAINT "OpenQuestion_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OpenQuestion_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OpenQuestion_answerEventId_fkey" FOREIGN KEY ("answerEventId") REFERENCES "RawIngestionEvent" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboundWebhookConfig_orgId_key" ON "OutboundWebhookConfig"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OpenQuestion_answerEventId_key" ON "OpenQuestion"("answerEventId");

-- CreateIndex
CREATE INDEX "OpenQuestion_trackerId_idx" ON "OpenQuestion"("trackerId");

-- CreateIndex
CREATE INDEX "OpenQuestion_stakeholderId_idx" ON "OpenQuestion"("stakeholderId");
