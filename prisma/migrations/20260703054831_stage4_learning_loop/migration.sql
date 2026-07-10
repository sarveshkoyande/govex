-- AlterTable
ALTER TABLE "OpenQuestion" ADD COLUMN "answerVerdict" TEXT;
ALTER TABLE "OpenQuestion" ADD COLUMN "answerVerdictReasoning" TEXT;
ALTER TABLE "OpenQuestion" ADD COLUMN "evaluatedAt" DATETIME;

-- CreateTable
CREATE TABLE "QuestionPatternStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "questionPattern" TEXT NOT NULL,
    "askedCount" INTEGER NOT NULL DEFAULT 0,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "usefulCount" INTEGER NOT NULL DEFAULT 0,
    "nonAnswerCount" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" DATETIME,
    "disabledReason" TEXT,
    "reenabledBy" TEXT,
    "reenabledAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "QuestionPatternStats_orgId_idx" ON "QuestionPatternStats"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionPatternStats_orgId_questionPattern_key" ON "QuestionPatternStats"("orgId", "questionPattern");
