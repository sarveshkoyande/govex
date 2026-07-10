import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getSessionUser, canWrite } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import ReviewQueue, { type SuggestionRow } from "@/components/synthesis/ReviewQueue";

export const metadata = { title: "Review AI Suggestions — GovEx" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!canWrite(user.role)) redirect("/");

  const { id } = await params;
  const tracker = await prisma.tracker.findFirst({ where: { id, orgId: user.orgId }, select: { id: true, name: true } });
  if (!tracker) notFound();

  const suggestions = await prisma.aiSuggestion.findMany({
    where: { trackerId: id },
    orderBy: { createdAt: "desc" },
    include: { targetTactic: { include: { microBattle: { select: { name: true } } } } },
  });

  const rows: SuggestionRow[] = suggestions.map((s) => ({
    id: s.id,
    kind: s.kind,
    title: s.title,
    text: s.text,
    signal: s.signal,
    confidence: s.confidence,
    rationale: s.rationale,
    status: s.status,
    createdAt: s.createdAt.toISOString(),
    reviewedBy: s.reviewedBy,
    tacticLabel: s.targetTactic ? `${s.targetTactic.microBattle.name} → ${s.targetTactic.name}` : null,
    sourceEventCount: (() => {
      try { return (JSON.parse(s.sourceEventIds) as unknown[]).length; } catch { return 0; }
    })(),
  }));

  const pending = rows.filter((r) => r.status === "PENDING");
  const decided = rows.filter((r) => r.status !== "PENDING");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <Link href={`/trackers/${id}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={13} /> Back to tracker
      </Link>
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-foreground">
          <Sparkles size={18} className="text-primary" /> Review AI Suggestions
        </h1>
        <p className="mt-1 max-w-2xl text-[12px] text-muted-foreground">
          Gemini-generated drafts for <span className="font-semibold text-foreground">{tracker.name}</span>. Nothing here
          is visible on the dashboard until you approve it — approving creates a real Execution/Outcome Insight or
          Strategy-vs-Outcome card with <code className="rounded bg-muted px-1 py-0.5 font-mono">source: GEMINI</code>.
        </p>
      </div>

      <ReviewQueue pending={pending} decided={decided} />
    </div>
  );
}
