import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PATTERN_MIN_SAMPLES, PATTERN_DISABLE_THRESHOLD } from "@/lib/enums";
import PatternStatsTable, { type PatternRow } from "@/components/settings/PatternStatsTable";

export const metadata = { title: "Question Patterns — GovEx" };

export default async function QuestionPatternsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "SYSTEM_ADMIN") redirect("/");

  const stats = await prisma.questionPatternStats.findMany({ where: { orgId: user.orgId }, orderBy: { questionPattern: "asc" } });

  const rows: PatternRow[] = stats.map((s) => ({
    questionPattern: s.questionPattern,
    askedCount: s.askedCount,
    answeredCount: s.answeredCount,
    usefulCount: s.usefulCount,
    nonAnswerCount: s.nonAnswerCount,
    enabled: s.enabled,
    disabledAt: s.disabledAt?.toISOString() ?? null,
    disabledReason: s.disabledReason,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={13} /> Back to dashboard
      </Link>
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-foreground">Question Patterns</h1>
        <p className="mt-1 max-w-2xl text-[12px] text-muted-foreground">
          Stage 4 — how well each type of question performs, scored automatically as replies come in. A pattern
          auto-disables (stops being drafted) once it has {PATTERN_MIN_SAMPLES}+ answers with a useful rate below{" "}
          {Math.round(PATTERN_DISABLE_THRESHOLD * 100)}% — always visible here and reversible.
        </p>
      </div>
      <PatternStatsTable rows={rows} />
    </div>
  );
}
