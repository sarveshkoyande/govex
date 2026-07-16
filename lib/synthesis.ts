import { prisma } from "@/lib/db";
import { loadSkills } from "@/lib/skills";
import { generateJson, GEMINI_MODEL_NAME } from "@/lib/gemini";
import { synthesisResponseSchema } from "@/lib/validation/synthesis";
import { filterAlreadyAsked, filterDisabledPatterns } from "@/lib/gaps";
import { deliverQuestion } from "@/lib/questionDelivery";

const MAX_EVENTS_PER_RUN = 30;

export type RunSynthesisResult =
  | { ok: true; runId: string; suggestionCount: number; clarificationCount: number }
  | { ok: false; error: string };

// Post-merger/acquisition-integration trackers get an extra framework skill
// (7S) beyond the standard synthesis set — SWOT/OKR-alignment ask "is this
// theme winning," 7S specifically asks "is the acquired practice fusing
// into the parent firm's operating model," which is the actual shape of
// BioPharm & Media Integration. Hardcoded to this one tracker rather than a
// generic "engagement type" field, since that's a real schema decision (new
// Tracker.engagementType enum, UI to set it, etc.) beyond what's needed for
// the one integration tracker that currently exists.
const SEVEN_S_TRACKER_IDS = new Set(["cmr4dpdfm000q3mcwogtweqqk"]); // BioPharm & Media Integration
// PAVE is an ongoing performance-based partnership, not an integration or a
// pre-deal sourcing decision — a JV marketing lifecycle lens (Pfizer as
// Product Company, Indegene as Service Company) fits its actual operational
// mechanics (DRE/PDE attribution, Gross Margin Share, baseline/true-up)
// better than a generic alliance-health check. alliance-health-pfizer-pave
// stays registered and chat-selectable as a secondary lens, just not
// auto-wired into every synthesis run. Same hardcoded-per-tracker approach
// as SEVEN_S_TRACKER_IDS above.
const JV_LIFECYCLE_TRACKER_IDS = new Set(["cmr4dpdga005o3mcw03ac0277"]); // Pfizer PAVE Collaboration

function buildPrompt(input: {
  trackerId: string;
  trackerName: string;
  strategyGoals: string[];
  okrs: { title: string; metrics: string | null }[];
  existingStrategyInsights: { title: string; description: string | null }[];
  tactics: { id: string; name: string; expectedOutcome: string | null; microBattleName: string }[];
  stakeholders: { id: string; name: string; ownsWhat: string | null }[];
  events: { id: string; source: string; subject: string | null; occurredAt: string; rawText: string }[];
}): string {
  const skillNames = ["tracker-synthesis", "tactic-insight-extraction", "detect-clarifications"] as const;
  const extraSkill = SEVEN_S_TRACKER_IDS.has(input.trackerId)
    ? (["framework-7s-biopharm"] as const)
    : JV_LIFECYCLE_TRACKER_IDS.has(input.trackerId)
      ? (["jv-marketing-lifecycle-pfizer-pave"] as const)
      : ([] as const);
  const skills = loadSkills([...skillNames, ...extraSkill]);

  return `You are the GovEx synthesis engine. Apply the skills below to the supplied tracker context and raw events, then return ONLY a single JSON object matching the schema at the end. Do not include markdown fences or any text outside the JSON object.

${skills}

## Tracker context

Tracker: ${input.trackerName}

Strategy goals:
${input.strategyGoals.map((g) => `- ${g}`).join("\n") || "(none recorded)"}

OKRs:
${input.okrs.map((o) => `- ${o.title}${o.metrics ? ` (${o.metrics})` : ""}`).join("\n") || "(none recorded)"}

Existing Strategy-vs-Outcome cards (for reference — propose an updated set):
${input.existingStrategyInsights.map((s) => `- ${s.title}: ${s.description ?? ""}`).join("\n") || "(none yet)"}

Existing execution tactics (use these EXACT ids when proposing tactic-level insights; do not invent new ones):
${input.tactics.map((t) => `- id="${t.id}" microBattle="${t.microBattleName}" name="${t.name}" expectedOutcome="${t.expectedOutcome ?? ""}"`).join("\n") || "(no tactics defined)"}

Stakeholders (use the EXACT "id" for a clarification's stakeholderId if one is a clear match):
${input.stakeholders.map((s) => `- id="${s.id}" name="${s.name}" ownsWhat="${s.ownsWhat ?? ""}"`).join("\n") || "(no stakeholders recorded)"}

## Raw ingestion events (use these EXACT ids for sourceEventIds)

${input.events.map((e) => `[id="${e.id}" source=${e.source} subject="${e.subject ?? ""}" occurredAt=${e.occurredAt}]\n${e.rawText}`).join("\n\n") || "(no raw events available — base strategyInsights only on the existing structured data above; tacticInsights should be empty)"}

## Required JSON output schema

{
  "strategyInsights": [ { "title": string, "text": string, "signal": "RISK"|"WATCH"|"ON_TRACK"|"OPPORTUNITY"|"NONE", "confidence": number (0-100), "rationale": string, "sourceEventIds": string[] } ],
  "tacticInsights": [ { "tacticId": string, "kind": "TACTIC_EXECUTION"|"TACTIC_OUTCOME", "text": string, "signal": "RISK"|"WATCH"|"ON_TRACK"|"OPPORTUNITY"|"NONE", "confidence": number (0-100), "rationale": string, "sourceEventIds": string[] } ],
  "clarifications": [ { "confusionType": "CONTRADICTION"|"UNDEFINED_TERM"|"UNCLEAR_OWNERSHIP"|"UNCLEAR_CONCEPT", "scope": "STRATEGY"|"TACTIC", "topic": string, "question": string, "rationale": string, "sourceEventIds": string[], "stakeholderId": string (optional) } ]
}`;
}

export async function runSynthesis(trackerId: string, orgId: string, triggeredBy: string): Promise<RunSynthesisResult> {
  const tracker = await prisma.tracker.findFirst({
    where: { id: trackerId, orgId },
    include: {
      strategyGoals: { orderBy: { order: "asc" } },
      okrs: { orderBy: { order: "asc" } },
      strategyInsights: { orderBy: { order: "asc" } },
      microBattles: { include: { executionTactics: true } },
      stakeholders: { select: { id: true, name: true, ownsWhat: true, isPrimary: true } },
    },
  });
  if (!tracker) return { ok: false, error: "Tracker not found." };

  // Only feed events this tracker hasn't been synthesized from yet — without
  // this filter, every re-run re-fed the same already-REVIEWED events back
  // to Gemini, which then re-derived the same insights and duplicated them
  // (approveSuggestion always .create()s, never dedupes against what's
  // already there — see lib/questions.ts note on the same append-only issue).
  const events = await prisma.rawIngestionEvent.findMany({
    where: { trackerId, status: "RECEIVED" },
    orderBy: { occurredAt: "desc" },
    take: MAX_EVENTS_PER_RUN,
  });

  const tactics = tracker.microBattles.flatMap((mb) =>
    mb.executionTactics.map((t) => ({
      id: t.id,
      name: t.name,
      expectedOutcome: t.expectedOutcome,
      microBattleName: mb.name,
    })),
  );

  const run = await prisma.synthesisRun.create({
    data: {
      trackerId,
      status: "RUNNING",
      model: GEMINI_MODEL_NAME,
      eventIds: JSON.stringify(events.map((e) => e.id)),
      triggeredBy,
    },
  });

  const prompt = buildPrompt({
    trackerId,
    trackerName: tracker.name,
    strategyGoals: tracker.strategyGoals.map((g) => g.text),
    okrs: tracker.okrs.map((o) => ({ title: o.title, metrics: o.metrics })),
    existingStrategyInsights: tracker.strategyInsights.map((s) => ({ title: s.title, description: s.description })),
    tactics,
    stakeholders: tracker.stakeholders.map((s) => ({ id: s.id, name: s.name, ownsWhat: s.ownsWhat })),
    events: events.map((e) => ({
      id: e.id,
      source: e.source,
      subject: e.subject,
      occurredAt: e.occurredAt.toISOString(),
      rawText: e.rawText,
    })),
  });

  let raw: string;
  try {
    raw = await generateJson(prompt);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Gemini API error.";
    await prisma.synthesisRun.update({ where: { id: run.id }, data: { status: "FAILED", errorMessage: message, completedAt: new Date() } });
    return { ok: false, error: `Gemini call failed: ${message}` };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    await prisma.synthesisRun.update({ where: { id: run.id }, data: { status: "FAILED", errorMessage: `Non-JSON response: ${raw.slice(0, 500)}`, completedAt: new Date() } });
    return { ok: false, error: "Gemini did not return valid JSON." };
  }

  const parsed = synthesisResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const message = parsed.error.errors[0]?.message ?? "Response did not match expected schema.";
    await prisma.synthesisRun.update({ where: { id: run.id }, data: { status: "FAILED", errorMessage: message, completedAt: new Date() } });
    return { ok: false, error: `Gemini response failed validation: ${message}` };
  }

  const validTacticIds = new Set(tactics.map((t) => t.id));
  const suggestionsData = [
    ...parsed.data.strategyInsights.map((s) => ({
      trackerId,
      synthesisRunId: run.id,
      targetTacticId: null,
      kind: "STRATEGY_INSIGHT",
      title: s.title,
      text: s.text,
      signal: s.signal,
      confidence: s.confidence,
      rationale: s.rationale,
      sourceEventIds: JSON.stringify(s.sourceEventIds),
    })),
    // Silently drop hallucinated tactic ids rather than crash the whole run —
    // the model occasionally invents ids despite instructions.
    ...parsed.data.tacticInsights
      .filter((t) => validTacticIds.has(t.tacticId))
      .map((t) => ({
        trackerId,
        synthesisRunId: run.id,
        targetTacticId: t.tacticId,
        kind: t.kind,
        title: null,
        text: t.text,
        signal: t.signal,
        confidence: t.confidence,
        rationale: t.rationale,
        sourceEventIds: JSON.stringify(t.sourceEventIds),
      })),
  ];

  if (suggestionsData.length) await prisma.aiSuggestion.createMany({ data: suggestionsData });

  // "Building a brain": clarifications go straight into the same OpenQuestion
  // pipeline as rule-based gaps (lib/gaps.ts) — dedupe against live questions,
  // respect the learning loop's disabled patterns, and (per the user's
  // explicit choice) auto-send immediately — no manual approval step.
  const validStakeholderIds = new Set(tracker.stakeholders.map((s) => s.id));
  const primaryStakeholder = tracker.stakeholders.find((s) => s.isPrimary) ?? null;

  const rawClarifications = parsed.data.clarifications.map((c) => ({
    pattern: c.confusionType,
    targetSummary: c.topic,
    questionText: c.question,
    rationale: c.rationale,
    stakeholderId: c.stakeholderId && validStakeholderIds.has(c.stakeholderId) ? c.stakeholderId : (primaryStakeholder?.id ?? null),
  }));
  const notAlreadyAsked = await filterAlreadyAsked(trackerId, rawClarifications);
  const clarifications = await filterDisabledPatterns(orgId, notAlreadyAsked);

  for (const c of clarifications) {
    const created = await prisma.openQuestion.create({
      data: {
        trackerId,
        stakeholderId: c.stakeholderId,
        questionPattern: c.pattern,
        targetSummary: c.targetSummary,
        questionText: c.questionText,
        rationale: c.rationale,
        source: "GEMINI",
      },
    });
    try {
      await deliverQuestion(created.id, "system:auto-synthesis");
    } catch (err) {
      console.error("[runSynthesis] auto-send failed for", created.id, err instanceof Error ? err.message : err);
    }
  }

  await prisma.synthesisRun.update({ where: { id: run.id }, data: { status: "COMPLETE", completedAt: new Date() } });
  if (events.length) await prisma.rawIngestionEvent.updateMany({ where: { id: { in: events.map((e) => e.id) } }, data: { status: "REVIEWED" } });

  return { ok: true, runId: run.id, suggestionCount: suggestionsData.length, clarificationCount: clarifications.length };
}
