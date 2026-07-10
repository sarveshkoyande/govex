import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil, History, Inbox, FlaskConical, Mail, Users2, Sparkles } from "lucide-react";
import GenerateInsightsButton from "@/components/synthesis/GenerateInsightsButton";
import DraftQuestionsButton from "@/components/synthesis/DraftQuestionsButton";
import OpenQuestionsPanel, { type QuestionRow } from "@/components/synthesis/OpenQuestionsPanel";
import { getSessionUser, canWrite } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { trackerInclude } from "@/lib/toDraft";
import { cn } from "@/lib/utils";
import { SignalPill, RagBadge, ConfidenceBadge } from "@/components/trackers/display";
import ThemeTabs, { type ThemeData } from "@/components/trackers/ThemeTabs";
import { buildGraph, egoNetwork } from "@/lib/graphData";
import KnowledgeGraph from "@/components/graph/KnowledgeGraph";

function money(v: number | null, currency: string) {
  return v == null ? "—" : `${currency === "USD" ? "$" : ""}${v}M`;
}

function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4 card-shadow", className)}>
      {title && <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>}
      {children}
    </div>
  );
}

const SEV: Record<string, string> = {
  High: "bg-red-50 text-red-600 ring-1 ring-red-200",
  Medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  Low: "bg-muted text-muted-foreground",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toThemeData(t: any): ThemeData {
  return {
    goals: (t.strategyGoals ?? []).map((g: any) => g.text),
    okrs: (t.okrs ?? []).map((o: any) => ({
      id: o.id,
      title: o.title,
      metrics: o.metrics ?? undefined,
      tags: o.tags ? String(o.tags).split(",").map((s: string) => s.trim()).filter(Boolean) : undefined,
    })),
    microBattles: (t.microBattles ?? []).map((mb: any) => ({
      id: mb.id,
      name: mb.name,
      executionTactics: (mb.executionTactics ?? []).map((tac: any) => ({
        id: tac.id,
        name: tac.name,
        expectedOutcome: tac.expectedOutcome ?? "",
        executionInsights: (tac.insights ?? []).filter((i: any) => i.kind === "EXECUTION").map((i: any) => ({ id: i.id, signal: i.signal, text: i.text, category: i.category ?? undefined })),
        outcomeInsights: (tac.insights ?? []).filter((i: any) => i.kind === "OUTCOME").map((i: any) => ({ id: i.id, signal: i.signal, text: i.text, category: i.category ?? undefined })),
      })),
    })),
    strategyInsights: (t.strategyInsights ?? []).map((s: any) => ({ id: s.id, title: s.title, description: s.description ?? "" })),
  };
}

export default async function TrackerDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;

  // Tenant-isolation: confirm ownership BEFORE running any other trackerId-scoped
  // query, rather than in parallel — a Promise.all here would still be safe today
  // (notFound() discards the results before render), but sequential-after-check
  // is the sturdier pattern and costs nothing extra in practice.
  const t = await prisma.tracker.findFirst({ where: { id, orgId: user.orgId }, include: trackerInclude });
  if (!t) notFound();

  const [history, ingestionEvents, pendingSuggestionCount, openQuestions, insightVotes] = await Promise.all([
    prisma.fieldChange.findMany({ where: { trackerId: id }, orderBy: { changedAt: "desc" }, take: 12 }),
    prisma.rawIngestionEvent.findMany({ where: { trackerId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.aiSuggestion.count({ where: { trackerId: id, status: "PENDING" } }),
    prisma.openQuestion.findMany({
      where: { trackerId: id },
      orderBy: { createdAt: "desc" },
      include: { stakeholder: { select: { name: true } }, answerEvent: { select: { rawText: true } } },
    }),
    prisma.insightFeedback.groupBy({
      by: ["insightId", "vote"],
      where: {
        orgId: user.orgId,
        insightId: {
          in: [
            ...t.strategyInsights.map((s: { id: string }) => s.id),
            ...t.microBattles.flatMap((mb: { executionTactics: { insights: { id: string }[] }[] }) =>
              mb.executionTactics.flatMap((tac) => tac.insights.map((i) => i.id)),
            ),
          ],
        },
      },
      _count: true,
    }),
  ]);
  const writable = canWrite(user.role);
  const theme = toThemeData(t);
  const voteCounts = new Map<string, { up: number; down: number }>();
  for (const v of insightVotes) {
    const entry = voteCounts.get(v.insightId) ?? { up: 0, down: 0 };
    if (v.vote === "UP") entry.up = v._count;
    else entry.down = v._count;
    voteCounts.set(v.insightId, entry);
  }
  theme.strategyInsights = theme.strategyInsights.map((s) => ({ ...s, upvotes: voteCounts.get(s.id)?.up ?? 0, downvotes: voteCounts.get(s.id)?.down ?? 0 }));
  theme.microBattles = theme.microBattles.map((mb) => ({
    ...mb,
    executionTactics: mb.executionTactics.map((tac) => ({
      ...tac,
      executionInsights: tac.executionInsights.map((i) => ({ ...i, upvotes: voteCounts.get(i.id ?? "")?.up ?? 0, downvotes: voteCounts.get(i.id ?? "")?.down ?? 0 })),
      outcomeInsights: tac.outcomeInsights.map((i) => ({ ...i, upvotes: voteCounts.get(i.id ?? "")?.up ?? 0, downvotes: voteCounts.get(i.id ?? "")?.down ?? 0 })),
    })),
  }));
  const fullGraph = await buildGraph(user.orgId);
  const connections = egoNetwork(fullGraph.nodes, fullGraph.edges, `TRACKER:${t.id}`);

  const questionRows: QuestionRow[] = openQuestions.map((q) => ({
    id: q.id,
    questionPattern: q.questionPattern,
    targetSummary: q.targetSummary,
    questionText: q.questionText,
    status: q.status,
    deliveryStatus: q.deliveryStatus,
    deliveryError: q.deliveryError,
    stakeholderId: q.stakeholderId,
    stakeholderName: q.stakeholder?.name ?? null,
    createdAt: q.createdAt.toISOString(),
    answeredEventText: q.answerEvent?.rawText ?? null,
    answerVerdict: q.answerVerdict,
    answerVerdictReasoning: q.answerVerdictReasoning,
  }));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft size={13} /> Back to dashboard
        </Link>
        <div className="flex items-center gap-2">
          {writable && pendingSuggestionCount > 0 && (
            <Link href={`/trackers/${t.id}/review`} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200">
              <Sparkles size={13} /> {pendingSuggestionCount} to review
            </Link>
          )}
          {writable && <GenerateInsightsButton trackerId={t.id} />}
          {writable && <DraftQuestionsButton trackerId={t.id} />}
          {writable && (
            <Link href={`/trackers/${t.id}/ingest-test`} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted">
              <FlaskConical size={13} /> Test Ingestion
            </Link>
          )}
          {writable && (
            <Link href={`/trackers/${t.id}/edit`} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              <Pencil size={13} /> Edit
            </Link>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{t.name}</h1>
          <SignalPill signal={t.signalStatus} />
          <RagBadge rag={t.ragStatus} />
          <ConfidenceBadge value={t.overallConfidence} />
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{t.lifecycleStatus}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{t.domain.name}</span>
          {t.ownerName && <span>Owner: <span className="font-semibold text-foreground">{t.ownerName}</span></span>}
          {t.targetPeriod && <span>Target: <span className="font-semibold text-foreground">{t.targetPeriod}</span></span>}
          <span>Updated {t.updatedAt.toLocaleDateString()}</span>
        </div>
        {t.description && <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{t.description}</p>}
        {/* Financial snapshot strip */}
        <div className="grid max-w-xl grid-cols-3 gap-3">
          {[{ k: "Budget", v: t.budget }, { k: "Spend", v: t.spend }, { k: "Forecast", v: t.forecast }].map(({ k, v }) => (
            <div key={k} className="rounded-lg border border-border bg-card p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</p>
              <p className="text-lg font-bold tabular-nums text-foreground">{money(v, t.currency)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── The 4-section theme view (Strategy / Execution / Outcomes / Strategy vs Outcome) ── */}
      <ThemeTabs data={theme} canVote={writable} />

      {/* ── Connections — this tracker's own neighborhood only, not the whole portfolio ── */}
      {connections.nodes.length > 1 && (
        <div className="flex flex-col gap-2">
          <p className="px-0.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Connections</p>
          <KnowledgeGraph nodes={connections.nodes} edges={connections.edges} />
        </div>
      )}

      {/* ── Operational detail (structured Stage-0 fields) ── */}
      <div className="mt-2 flex flex-col gap-3">
        <p className="px-0.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Operational detail</p>

        {t.financialMetrics.length > 0 && (
          <Card title="Financial Metrics">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-1.5 pr-3 font-semibold">Metric</th><th className="py-1.5 pr-3 font-semibold">Period</th>
                    <th className="py-1.5 pr-3 font-semibold">Planned</th><th className="py-1.5 pr-3 font-semibold">Actual</th>
                    <th className="py-1.5 pr-3 font-semibold">Forecast</th><th className="py-1.5 font-semibold">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {t.financialMetrics.map((f) => (
                    <tr key={f.id} className="border-b border-border/50">
                      <td className="py-1.5 pr-3 font-medium text-foreground">{f.label}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{f.period ?? "—"}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{f.planned ?? "—"}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{f.actual ?? "—"}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{f.forecast ?? "—"}</td>
                      <td className="py-1.5"><ConfidenceBadge value={f.confidence} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Card title={`Stakeholders (${t.stakeholders.length})`}>
            {t.stakeholders.length === 0 ? <p className="text-xs text-muted-foreground">None recorded.</p> : (
              <ul className="flex flex-col gap-2">
                {t.stakeholders.map((s) => (
                  <li key={s.id} className="flex flex-col border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <span className="text-sm font-semibold text-foreground">{s.name} {s.isPrimary && <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">Primary</span>}</span>
                    <span className="text-[11px] text-muted-foreground">{[s.roleOnTracker, s.ownsWhat].filter(Boolean).join(" · ") || "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={`Risks (${t.risks.length})`}>
            {t.risks.length === 0 ? <p className="text-xs text-muted-foreground">None recorded.</p> : (
              <ul className="flex flex-col gap-2">
                {t.risks.map((r) => (
                  <li key={r.id} className="flex items-start gap-2 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                    <span className={cn("mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold", SEV[r.severity])}>{r.severity}</span>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-foreground">{r.title}</p>
                      {r.mitigation && <p className="text-[11px] text-muted-foreground">{r.mitigation}</p>}
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground">{r.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title={`Next Actions (${t.nextActions.length})`}>
          {t.nextActions.length === 0 ? <p className="text-xs text-muted-foreground">None recorded.</p> : (
            <ul className="flex flex-col gap-1.5">
              {t.nextActions.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-1.5 last:border-0 last:pb-0">
                  <span className={cn("h-2 w-2 rounded-full", a.status === "done" ? "bg-emerald-500" : a.status === "in_progress" ? "bg-blue-500" : "bg-red-400")} />
                  <span className={cn("flex-1 text-xs", a.status === "done" ? "text-muted-foreground line-through" : "text-foreground")}>{a.title}</span>
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">{a.assigneeGroup === "you" ? "For you" : "Team"}</span>
                  <span className="text-[10px] text-muted-foreground">{a.owner || "—"}</span>
                  <span className="text-[10px] text-muted-foreground">{a.dueDate || "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {t.decisionLog.length > 0 && (
          <Card title={`Decision Log (${t.decisionLog.length})`}>
            <ul className="flex flex-col gap-2">
              {t.decisionLog.map((d) => (
                <li key={d.id} className="border-b border-border/50 pb-2 last:border-0 last:pb-0">
                  <p className="text-xs font-medium text-foreground">{d.decision}</p>
                  {d.rationale && <p className="text-[11px] text-muted-foreground">{d.rationale}</p>}
                  {d.decidedBy && <p className="text-[10px] text-muted-foreground">— {d.decidedBy}</p>}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title={`Open Questions (${questionRows.filter((r) => r.status !== "DISMISSED").length})`}>
          <p className="-mt-1 text-[11px] text-muted-foreground">Rule-detected gaps + Gemini-flagged confusion, drafted and sent automatically to the matched stakeholder — no manual approval step. Dismiss any that shouldn&apos;t have gone out.</p>
          <OpenQuestionsPanel rows={questionRows} stakeholders={t.stakeholders.map((s) => ({ id: s.id, name: s.name }))} />
        </Card>

        <Card title={`Raw Ingestion Events (${ingestionEvents.length})`}>
          <p className="-mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Inbox size={12} /> Stage 1 — stored as-is from Power Automate / the test injector. No AI has read these yet.
          </p>
          {ingestionEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No ingested events yet. Use <span className="font-semibold text-foreground">Test Ingestion</span> above to simulate one.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ingestionEvents.map((ev) => (
                <li key={ev.id} className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                      {ev.source === "EMAIL" ? <Mail size={9} /> : <Users2 size={9} />} {ev.source}
                    </span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">{ev.sourceSystem}</span>
                    {ev.subject && <span className="text-xs font-semibold text-foreground">{ev.subject}</span>}
                    <span className="ml-auto text-[10px] text-muted-foreground">{ev.occurredAt.toLocaleString()}</span>
                  </div>
                  {(ev.fromAddress || ev.participants) && (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {ev.fromAddress && <>From: <span className="text-foreground">{ev.fromAddress}</span></>}
                      {ev.fromAddress && ev.participants && " · "}
                      {ev.participants && <>Participants: {ev.participants}</>}
                    </p>
                  )}
                  <p className="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-foreground/80">{ev.rawText}</p>
                  <p className="mt-1 text-[9px] text-muted-foreground">ingested via {ev.ingestedVia} · {ev.createdAt.toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Field Change History">
          <p className="-mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><History size={12} /> Append-only record — &quot;what we believed then vs now.&quot;</p>
          {history.length === 0 ? <p className="text-xs text-muted-foreground">No changes recorded yet.</p> : (
            <ul className="flex flex-col gap-1.5">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{h.fieldKey}</span>
                  <span className="text-muted-foreground line-through">{h.oldValue ?? "∅"}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="font-semibold text-foreground">{h.newValue ?? "∅"}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{h.changedBy} · {h.changedAt.toLocaleDateString()} · {h.source}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
