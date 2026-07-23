-- CreateTable
CREATE TABLE "ExternalOrg" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalOrg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConceptPage" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "trackerId" TEXT,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT,
    "subjectTerm" TEXT,
    "title" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "sourceEventIds" TEXT NOT NULL DEFAULT '[]',
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "verificationStatus" TEXT NOT NULL DEFAULT 'AI_COMPILED',
    "contradictions" TEXT NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastCompiledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConceptPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalOrg_orgId_idx" ON "ExternalOrg"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalOrg_orgId_name_key" ON "ExternalOrg"("orgId", "name");

-- CreateIndex
CREATE INDEX "ConceptPage_orgId_idx" ON "ConceptPage"("orgId");

-- CreateIndex
CREATE INDEX "ConceptPage_trackerId_idx" ON "ConceptPage"("trackerId");

-- CreateIndex
CREATE UNIQUE INDEX "ConceptPage_orgId_subjectType_subjectId_subjectTerm_key" ON "ConceptPage"("orgId", "subjectType", "subjectId", "subjectTerm");

-- AddForeignKey
ALTER TABLE "ExternalOrg" ADD CONSTRAINT "ExternalOrg_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConceptPage" ADD CONSTRAINT "ConceptPage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
