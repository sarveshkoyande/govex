-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "autoApproveSkillPatches" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomSkill" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsightFeedback" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "insightType" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "vote" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InsightFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillPatchProposal" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "SkillPatchProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New chat',
    "historyJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT,
    "toolName" TEXT,
    "toolArgs" TEXT,
    "toolResult" TEXT,
    "proposalKind" TEXT,
    "proposalPayload" TEXT,
    "proposalStatus" TEXT,
    "proposalTrackerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionApiKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPreview" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "IngestionApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawIngestionEvent" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT,
    "domainId" TEXT,
    "apiKeyId" TEXT,
    "source" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "subject" TEXT,
    "fromAddress" TEXT,
    "participants" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "rawText" TEXT NOT NULL,
    "fileName" TEXT,
    "rawPayload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "ingestedVia" TEXT NOT NULL DEFAULT 'webhook',
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RawIngestionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityMention" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "targetTerm" TEXT,
    "trackerId" TEXT,
    "method" TEXT NOT NULL,
    "contextSnippet" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "reasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityMention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DismissedEntityCandidate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DismissedEntityCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "externalId" TEXT,
    "authProvider" TEXT NOT NULL DEFAULT 'credentials',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EXEC_VIEWER',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Domain" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tracker" (
    "id" TEXT NOT NULL,
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
    "budget" DOUBLE PRECISION,
    "spend" DOUBLE PRECISION,
    "forecast" DOUBLE PRECISION,
    "overallConfidence" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "Tracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stakeholder" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "roleOnTracker" TEXT,
    "ownsWhat" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stakeholder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialMetric" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "period" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'USD_M',
    "planned" DOUBLE PRECISION,
    "actual" DOUBLE PRECISION,
    "forecast" DOUBLE PRECISION,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Open',
    "mitigation" TEXT,
    "owner" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NextAction" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT,
    "assigneeGroup" TEXT NOT NULL DEFAULT 'you',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "dueDate" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NextAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DecisionLogEntry" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT,
    "decidedBy" TEXT,
    "decidedOn" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyGoal" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StrategyGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Okr" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "metrics" TEXT,
    "tags" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Okr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MicroBattle" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "ragStatus" TEXT NOT NULL DEFAULT 'GREEN',
    "order" INTEGER NOT NULL DEFAULT 0,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicroBattle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionTactic" (
    "id" TEXT NOT NULL,
    "microBattleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expectedOutcome" TEXT,
    "owner" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "order" INTEGER NOT NULL DEFAULT 0,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionTactic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TacticInsight" (
    "id" TEXT NOT NULL,
    "tacticId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "signal" TEXT NOT NULL DEFAULT 'NONE',
    "text" TEXT NOT NULL,
    "category" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TacticInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategyInsight" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidence" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "StrategyInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SynthesisRun" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "model" TEXT NOT NULL,
    "eventIds" TEXT NOT NULL,
    "errorMessage" TEXT,
    "triggeredBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SynthesisRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSuggestion" (
    "id" TEXT NOT NULL,
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
    "reviewedAt" TIMESTAMP(3),
    "materializedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundWebhookConfig" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,

    CONSTRAINT "OutboundWebhookConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpenQuestion" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "askedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "answerVerdict" TEXT,
    "answerVerdictReasoning" TEXT,
    "evaluatedAt" TIMESTAMP(3),

    CONSTRAINT "OpenQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionPatternStats" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "questionPattern" TEXT NOT NULL,
    "askedCount" INTEGER NOT NULL DEFAULT 0,
    "answeredCount" INTEGER NOT NULL DEFAULT 0,
    "usefulCount" INTEGER NOT NULL DEFAULT 0,
    "nonAnswerCount" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMP(3),
    "disabledReason" TEXT,
    "reenabledBy" TEXT,
    "reenabledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionPatternStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldState" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "staleAfterDays" INTEGER NOT NULL DEFAULT 90,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedBy" TEXT,

    CONSTRAINT "FieldState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldChange" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "confidenceAfter" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FieldChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "CustomSkill_orgId_idx" ON "CustomSkill"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomSkill_orgId_name_key" ON "CustomSkill"("orgId", "name");

-- CreateIndex
CREATE INDEX "InsightFeedback_orgId_idx" ON "InsightFeedback"("orgId");

-- CreateIndex
CREATE INDEX "InsightFeedback_insightType_insightId_idx" ON "InsightFeedback"("insightType", "insightId");

-- CreateIndex
CREATE INDEX "SkillPatchProposal_orgId_idx" ON "SkillPatchProposal"("orgId");

-- CreateIndex
CREATE INDEX "ChatSession_orgId_idx" ON "ChatSession"("orgId");

-- CreateIndex
CREATE INDEX "ChatSession_userId_idx" ON "ChatSession"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionApiKey_tokenHash_key" ON "IngestionApiKey"("tokenHash");

-- CreateIndex
CREATE INDEX "IngestionApiKey_orgId_idx" ON "IngestionApiKey"("orgId");

-- CreateIndex
CREATE INDEX "RawIngestionEvent_trackerId_idx" ON "RawIngestionEvent"("trackerId");

-- CreateIndex
CREATE INDEX "RawIngestionEvent_domainId_idx" ON "RawIngestionEvent"("domainId");

-- CreateIndex
CREATE INDEX "RawIngestionEvent_apiKeyId_idx" ON "RawIngestionEvent"("apiKeyId");

-- CreateIndex
CREATE INDEX "EntityMention_orgId_idx" ON "EntityMention"("orgId");

-- CreateIndex
CREATE INDEX "EntityMention_sourceType_sourceId_idx" ON "EntityMention"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "EntityMention_targetType_targetId_idx" ON "EntityMention"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "EntityMention_trackerId_targetType_idx" ON "EntityMention"("trackerId", "targetType");

-- CreateIndex
CREATE INDEX "DismissedEntityCandidate_orgId_idx" ON "DismissedEntityCandidate"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "DismissedEntityCandidate_trackerId_term_key" ON "DismissedEntityCandidate"("trackerId", "term");

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
CREATE INDEX "SynthesisRun_trackerId_idx" ON "SynthesisRun"("trackerId");

-- CreateIndex
CREATE INDEX "AiSuggestion_trackerId_idx" ON "AiSuggestion"("trackerId");

-- CreateIndex
CREATE INDEX "AiSuggestion_synthesisRunId_idx" ON "AiSuggestion"("synthesisRunId");

-- CreateIndex
CREATE INDEX "AiSuggestion_targetTacticId_idx" ON "AiSuggestion"("targetTacticId");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundWebhookConfig_orgId_key" ON "OutboundWebhookConfig"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OpenQuestion_answerEventId_key" ON "OpenQuestion"("answerEventId");

-- CreateIndex
CREATE INDEX "OpenQuestion_trackerId_idx" ON "OpenQuestion"("trackerId");

-- CreateIndex
CREATE INDEX "OpenQuestion_stakeholderId_idx" ON "OpenQuestion"("stakeholderId");

-- CreateIndex
CREATE INDEX "QuestionPatternStats_orgId_idx" ON "QuestionPatternStats"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionPatternStats_orgId_questionPattern_key" ON "QuestionPatternStats"("orgId", "questionPattern");

-- CreateIndex
CREATE INDEX "FieldState_trackerId_idx" ON "FieldState"("trackerId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldState_entityType_entityId_fieldKey_key" ON "FieldState"("entityType", "entityId", "fieldKey");

-- CreateIndex
CREATE INDEX "FieldChange_trackerId_idx" ON "FieldChange"("trackerId");

-- CreateIndex
CREATE INDEX "FieldChange_entityType_entityId_idx" ON "FieldChange"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "CustomSkill" ADD CONSTRAINT "CustomSkill_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsightFeedback" ADD CONSTRAINT "InsightFeedback_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPatchProposal" ADD CONSTRAINT "SkillPatchProposal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionApiKey" ADD CONSTRAINT "IngestionApiKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawIngestionEvent" ADD CONSTRAINT "RawIngestionEvent_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawIngestionEvent" ADD CONSTRAINT "RawIngestionEvent_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawIngestionEvent" ADD CONSTRAINT "RawIngestionEvent_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "IngestionApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityMention" ADD CONSTRAINT "EntityMention_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DismissedEntityCandidate" ADD CONSTRAINT "DismissedEntityCandidate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tracker" ADD CONSTRAINT "Tracker_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tracker" ADD CONSTRAINT "Tracker_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stakeholder" ADD CONSTRAINT "Stakeholder_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialMetric" ADD CONSTRAINT "FinancialMetric_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NextAction" ADD CONSTRAINT "NextAction_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DecisionLogEntry" ADD CONSTRAINT "DecisionLogEntry_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyGoal" ADD CONSTRAINT "StrategyGoal_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Okr" ADD CONSTRAINT "Okr_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicroBattle" ADD CONSTRAINT "MicroBattle_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionTactic" ADD CONSTRAINT "ExecutionTactic_microBattleId_fkey" FOREIGN KEY ("microBattleId") REFERENCES "MicroBattle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TacticInsight" ADD CONSTRAINT "TacticInsight_tacticId_fkey" FOREIGN KEY ("tacticId") REFERENCES "ExecutionTactic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrategyInsight" ADD CONSTRAINT "StrategyInsight_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SynthesisRun" ADD CONSTRAINT "SynthesisRun_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_synthesisRunId_fkey" FOREIGN KEY ("synthesisRunId") REFERENCES "SynthesisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_targetTacticId_fkey" FOREIGN KEY ("targetTacticId") REFERENCES "ExecutionTactic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundWebhookConfig" ADD CONSTRAINT "OutboundWebhookConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenQuestion" ADD CONSTRAINT "OpenQuestion_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenQuestion" ADD CONSTRAINT "OpenQuestion_stakeholderId_fkey" FOREIGN KEY ("stakeholderId") REFERENCES "Stakeholder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpenQuestion" ADD CONSTRAINT "OpenQuestion_answerEventId_fkey" FOREIGN KEY ("answerEventId") REFERENCES "RawIngestionEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldState" ADD CONSTRAINT "FieldState_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldChange" ADD CONSTRAINT "FieldChange_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
