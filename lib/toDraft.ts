import type { TrackerDraft } from "@/lib/types";

const s = (v: unknown) => (v == null ? "" : String(v));

// Maps a fully-included Prisma tracker record into the form's draft shape.
// Loosely typed to avoid dragging Prisma generic payloads through the UI.
export function trackerToDraft(t: any): TrackerDraft {
  return {
    id: t.id,
    domainId: t.domainId,
    name: t.name ?? "",
    description: t.description ?? "",
    strategyObjective: t.strategyObjective ?? "",
    okrObjective: t.okrObjective ?? "",
    lifecycleStatus: t.lifecycleStatus,
    ragStatus: t.ragStatus,
    signalStatus: t.signalStatus,
    ownerName: t.ownerName ?? "",
    targetPeriod: t.targetPeriod ?? "",
    currency: t.currency ?? "USD",
    budget: s(t.budget),
    spend: s(t.spend),
    forecast: s(t.forecast),
    overallConfidence: t.overallConfidence ?? 50,
    stakeholders: (t.stakeholders ?? []).map((x: any) => ({
      name: x.name ?? "", email: x.email ?? "", roleOnTracker: x.roleOnTracker ?? "",
      ownsWhat: x.ownsWhat ?? "", isPrimary: !!x.isPrimary,
    })),
    financialMetrics: (t.financialMetrics ?? []).map((x: any) => ({
      label: x.label ?? "", period: x.period ?? "", unit: x.unit ?? "USD_M",
      planned: s(x.planned), actual: s(x.actual), forecast: s(x.forecast), confidence: x.confidence ?? 50,
    })),
    risks: (t.risks ?? []).map((x: any) => ({
      title: x.title ?? "", severity: x.severity ?? "Medium", status: x.status ?? "Open",
      mitigation: x.mitigation ?? "", owner: x.owner ?? "", confidence: x.confidence ?? 50,
    })),
    nextActions: (t.nextActions ?? []).map((x: any) => ({
      title: x.title ?? "", owner: x.owner ?? "", assigneeGroup: x.assigneeGroup ?? "you",
      priority: x.priority ?? "medium", status: x.status ?? "open", dueDate: x.dueDate ?? "",
    })),
    decisionLog: (t.decisionLog ?? []).map((x: any) => ({
      decision: x.decision ?? "", rationale: x.rationale ?? "", decidedBy: x.decidedBy ?? "",
    })),
    strategyGoals: (t.strategyGoals ?? []).map((x: any) => ({ text: x.text ?? "" })),
    okrs: (t.okrs ?? []).map((x: any) => ({ title: x.title ?? "", metrics: x.metrics ?? "", tags: x.tags ?? "" })),
    microBattles: (t.microBattles ?? []).map((mb: any) => ({
      code: mb.code ?? "", name: mb.name ?? "", ragStatus: mb.ragStatus ?? "GREEN",
      tactics: (mb.executionTactics ?? []).map((tac: any) => ({
        name: tac.name ?? "", expectedOutcome: tac.expectedOutcome ?? "", status: tac.status ?? "Open",
        executionInsights: (tac.insights ?? []).filter((i: any) => i.kind === "EXECUTION").map((i: any) => ({ signal: i.signal ?? "NONE", text: i.text ?? "" })),
        outcomeInsights: (tac.insights ?? []).filter((i: any) => i.kind === "OUTCOME").map((i: any) => ({ signal: i.signal ?? "NONE", text: i.text ?? "" })),
      })),
    })),
    strategyInsights: (t.strategyInsights ?? []).map((x: any) => ({ title: x.title ?? "", description: x.description ?? "" })),
  };
}

// The relation include used by edit + detail pages.
export const trackerInclude = {
  domain: true,
  stakeholders: true,
  financialMetrics: true,
  risks: true,
  nextActions: true,
  decisionLog: { orderBy: { createdAt: "asc" } },
  strategyGoals: { orderBy: { order: "asc" } },
  okrs: { orderBy: { order: "asc" } },
  strategyInsights: { orderBy: { order: "asc" } },
  microBattles: {
    orderBy: { order: "asc" },
    include: {
      executionTactics: {
        orderBy: { order: "asc" },
        include: { insights: { orderBy: { order: "asc" } } },
      },
    },
  },
} as const;
