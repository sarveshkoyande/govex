import { prisma } from "@/lib/db";
import { loadSkill } from "@/lib/skills";
import { generateJson } from "@/lib/gemini";
import { trackerToDraft, trackerInclude } from "@/lib/toDraft";
import { wholeTrackerGapResponseSchema } from "@/lib/validation/synthesis";
import type { Gap } from "@/lib/gaps";

// A separate agent from the rule-based lib/gaps.ts — reasons over the WHOLE
// tracker (strategy, execution, financials, stakeholders, risks, decisions)
// instead of three narrow field checks. Runs alongside detectGaps(), not in
// place of it (see lib/questions.ts), feeding the same shared dedupe/draft/
// send pipeline via the same Gap shape.
export async function detectWholeTrackerGaps(trackerId: string, orgId: string): Promise<Gap[]> {
  const tracker = await prisma.tracker.findFirst({ where: { id: trackerId, orgId }, include: trackerInclude });
  if (!tracker) return [];

  const draft = trackerToDraft(tracker);
  const skill = loadSkill("whole-tracker-gap-detection");

  const prompt = `${skill}

## Full tracker context

Name: ${draft.name}
Description: ${draft.description || "(none)"}
Lifecycle: ${draft.lifecycleStatus} | RAG: ${draft.ragStatus} | Signal: ${draft.signalStatus}

Strategy goals:
${draft.strategyGoals.map((g) => `- ${g.text}`).join("\n") || "(none recorded)"}

OKRs:
${draft.okrs.map((o) => `- ${o.title}${o.metrics ? ` (${o.metrics})` : ""}`).join("\n") || "(none recorded)"}

Micro-battles / execution tactics:
${
  draft.microBattles
    .flatMap((mb) =>
      mb.tactics.map(
        (t) =>
          `- [${mb.name}] ${t.name} (status: ${t.status}, expected: ${t.expectedOutcome || "n/a"})\n` +
          t.executionInsights.map((i) => `    execution(${i.signal}): ${i.text}`).join("\n") +
          (t.executionInsights.length ? "\n" : "") +
          t.outcomeInsights.map((i) => `    outcome(${i.signal}): ${i.text}`).join("\n"),
      ),
    )
    .join("\n") || "(no tactics defined)"
}

Strategy-vs-Outcome cards:
${draft.strategyInsights.map((s) => `- ${s.title}: ${s.description}`).join("\n") || "(none yet)"}

Financials: currency=${draft.currency} budget=${draft.budget} spend=${draft.spend} forecast=${draft.forecast}
${draft.financialMetrics.map((f) => `- ${f.label} (${f.period}): planned=${f.planned} actual=${f.actual} forecast=${f.forecast}`).join("\n") || "(no detailed metrics)"}

Stakeholders:
${draft.stakeholders.map((s) => `- ${s.name}${s.isPrimary ? " [primary]" : ""}: owns "${s.ownsWhat}"`).join("\n") || "(none recorded)"}

Risks:
${draft.risks.map((r) => `- ${r.title} (${r.severity}, ${r.status}) mitigation: ${r.mitigation || "(none)"}`).join("\n") || "(none recorded)"}

Decision log:
${draft.decisionLog.map((d) => `- ${d.decision} — rationale: ${d.rationale || "(none)"}`).join("\n") || "(none recorded)"}

## Required JSON output schema

{ "gaps": [ { "targetSummary": string, "rationale": string } ] }

Return ONLY the JSON object, no markdown fences, no other text.`;

  let raw: string;
  try {
    raw = await generateJson(prompt);
  } catch (err) {
    console.error("[detectWholeTrackerGaps] Gemini call failed for", trackerId, err instanceof Error ? err.message : err);
    return [];
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return [];
  }

  const result = wholeTrackerGapResponseSchema.safeParse(parsedJson);
  if (!result.success) return [];

  return result.data.gaps.map((g) => ({
    pattern: "AI_WHOLE_TRACKER_GAP" as const,
    targetSummary: g.targetSummary,
    rationale: g.rationale,
  }));
}
