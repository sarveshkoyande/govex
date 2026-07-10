-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "externalId" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'credentials',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EXEC_VIEWER',
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Domain_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tracker" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "strategyObjective" TEXT,
    "okrObjective" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "ragStatus" TEXT NOT NULL DEFAULT 'GREEN',
    "signalStatus" TEXT NOT NULL DEFAULT 'ON_TRACK',
    "ownerId" TEXT,
    "ownerName" TEXT,
    "targetPeriod" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "budget" REAL,
    "spend" REAL,
    "forecast" REAL,
    "overallConfidence" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "Tracker_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Tracker_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Stakeholder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "roleOnTracker" TEXT,
    "ownsWhat" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Stakeholder_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "period" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'USD_M',
    "planned" REAL,
    "actual" REAL,
    "forecast" REAL,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancialMetric_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "mitigation" TEXT,
    "owner" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Risk_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NextAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT,
    "assigneeGroup" TEXT NOT NULL DEFAULT 'you',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueDate" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NextAction_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DecisionLogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT,
    "decidedBy" TEXT,
    "decidedOn" DATETIME,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DecisionLogEntry_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StrategyGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StrategyGoal_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Okr" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metrics" TEXT,
    "tags" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Okr_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MicroBattle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "ragStatus" TEXT NOT NULL DEFAULT 'GREEN',
    "order" INTEGER NOT NULL DEFAULT 0,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MicroBattle_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExecutionTactic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "microBattleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expectedOutcome" TEXT,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "order" INTEGER NOT NULL DEFAULT 0,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExecutionTactic_microBattleId_fkey" FOREIGN KEY ("microBattleId") REFERENCES "MicroBattle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TacticInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tacticId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "signal" TEXT NOT NULL DEFAULT 'NONE',
    "text" TEXT NOT NULL,
    "category" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TacticInsight_tacticId_fkey" FOREIGN KEY ("tacticId") REFERENCES "ExecutionTactic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StrategyInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StrategyInsight_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "staleAfterDays" INTEGER NOT NULL DEFAULT 90,
    "lastUpdatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedBy" TEXT,
    CONSTRAINT "FieldState_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidenceAfter" INTEGER,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FieldChange_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_orgId_idx" ON "User"("orgId");

-- CreateIndex
CREATE INDEX "User_externalId_idx" ON "User"("externalId");

-- CreateIndex
CREATE INDEX "Membership_orgId_idx" ON "Membership"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_orgId_key" ON "Membership"("userId", "orgId");

-- CreateIndex
CREATE INDEX "Domain_orgId_idx" ON "Domain"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Domain_orgId_slug_key" ON "Domain"("orgId", "slug");

-- CreateIndex
CREATE INDEX "Tracker_orgId_idx" ON "Tracker"("orgId");

-- CreateIndex
CREATE INDEX "Tracker_domainId_idx" ON "Tracker"("domainId");

-- CreateIndex
CREATE INDEX "Stakeholder_trackerId_idx" ON "Stakeholder"("trackerId");

-- CreateIndex
CREATE INDEX "FinancialMetric_trackerId_idx" ON "FinancialMetric"("trackerId");

-- CreateIndex
CREATE INDEX "Risk_trackerId_idx" ON "Risk"("trackerId");

-- CreateIndex
CREATE INDEX "NextAction_trackerId_idx" ON "NextAction"("trackerId");

-- CreateIndex
CREATE INDEX "DecisionLogEntry_trackerId_idx" ON "DecisionLogEntry"("trackerId");

-- CreateIndex
CREATE INDEX "StrategyGoal_trackerId_idx" ON "StrategyGoal"("trackerId");

-- CreateIndex
CREATE INDEX "Okr_trackerId_idx" ON "Okr"("trackerId");

-- CreateIndex
CREATE INDEX "MicroBattle_trackerId_idx" ON "MicroBattle"("trackerId");

-- CreateIndex
CREATE INDEX "ExecutionTactic_microBattleId_idx" ON "ExecutionTactic"("microBattleId");

-- CreateIndex
CREATE INDEX "TacticInsight_tacticId_idx" ON "TacticInsight"("tacticId");

-- CreateIndex
CREATE INDEX "StrategyInsight_trackerId_idx" ON "StrategyInsight"("trackerId");

-- CreateIndex
CREATE INDEX "FieldState_trackerId_idx" ON "FieldState"("trackerId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldState_entityType_entityId_fieldKey_key" ON "FieldState"("entityType", "entityId", "fieldKey");

-- CreateIndex
CREATE INDEX "FieldChange_trackerId_idx" ON "FieldChange"("trackerId");

-- CreateIndex
CREATE INDEX "FieldChange_entityType_entityId_idx" ON "FieldChange"("entityType", "entityId");
