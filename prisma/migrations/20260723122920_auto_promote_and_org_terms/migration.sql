-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "autoPromoteEntities" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "OrgTerm" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'specific',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgTerm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgTerm_orgId_idx" ON "OrgTerm"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgTerm_orgId_term_key" ON "OrgTerm"("orgId", "term");

-- AddForeignKey
ALTER TABLE "OrgTerm" ADD CONSTRAINT "OrgTerm_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
