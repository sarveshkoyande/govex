-- Replace the (subjectType, subjectId, subjectTerm) unique with a single
-- always-non-null subjectKey, since NULLs in the old triple made the unique
-- unenforceable in Postgres. Table is newly created and empty, so the
-- NOT NULL column is added directly (temporary default, then dropped).

-- DropIndex
DROP INDEX "ConceptPage_orgId_subjectType_subjectId_subjectTerm_key";

-- AlterTable
ALTER TABLE "ConceptPage" ADD COLUMN "subjectKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ConceptPage" ALTER COLUMN "subjectKey" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "ConceptPage_orgId_subjectKey_key" ON "ConceptPage"("orgId", "subjectKey");
