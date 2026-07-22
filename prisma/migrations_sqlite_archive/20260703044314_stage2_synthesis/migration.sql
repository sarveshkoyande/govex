-- CreateTable
CREATE TABLE "SynthesisRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "model" TEXT NOT NULL,
    "eventIds" TEXT NOT NULL,
    "errorMessage" TEXT,
    "triggeredBy" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "SynthesisRun_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "synthesisRunId" TEXT NOT NULL,
    "targetTacticId" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "text" TEXT NOT NULL,
    "signal" TEXT NOT NULL DEFAULT 'NONE',
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "rationale" TEXT,
    "sourceEventIds" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "materializedId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiSuggestion_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiSuggestion_synthesisRunId_fkey" FOREIGN KEY ("synthesisRunId") REFERENCES "SynthesisRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiSuggestion_targetTacticId_fkey" FOREIGN KEY ("targetTacticId") REFERENCES "ExecutionTactic" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StrategyInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidence" INTEGER NOT NULL DEFAULT 50,
    CONSTRAINT "StrategyInsight_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StrategyInsight" ("description", "id", "order", "title", "trackerId") SELECT "description", "id", "order", "title", "trackerId" FROM "StrategyInsight";
DROP TABLE "StrategyInsight";
ALTER TABLE "new_StrategyInsight" RENAME TO "StrategyInsight";
CREATE INDEX "StrategyInsight_trackerId_idx" ON "StrategyInsight"("trackerId");
CREATE TABLE "new_TacticInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tacticId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "signal" TEXT NOT NULL DEFAULT 'NONE',
    "text" TEXT NOT NULL,
    "category" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TacticInsight_tacticId_fkey" FOREIGN KEY ("tacticId") REFERENCES "ExecutionTactic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TacticInsight" ("category", "createdAt", "id", "kind", "order", "signal", "source", "tacticId", "text") SELECT "category", "createdAt", "id", "kind", "order", "signal", "source", "tacticId", "text" FROM "TacticInsight";
DROP TABLE "TacticInsight";
ALTER TABLE "new_TacticInsight" RENAME TO "TacticInsight";
CREATE INDEX "TacticInsight_tacticId_idx" ON "TacticInsight"("tacticId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SynthesisRun_trackerId_idx" ON "SynthesisRun"("trackerId");

-- CreateIndex
CREATE INDEX "AiSuggestion_trackerId_idx" ON "AiSuggestion"("trackerId");

-- CreateIndex
CREATE INDEX "AiSuggestion_synthesisRunId_idx" ON "AiSuggestion"("synthesisRunId");

-- CreateIndex
CREATE INDEX "AiSuggestion_targetTacticId_idx" ON "AiSuggestion"("targetTacticId");
