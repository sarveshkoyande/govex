import { prisma } from "@/lib/db";
import { detectGaps, filterAlreadyAsked, filterDisabledPatterns, type Gap } from "@/lib/gaps";
import { detectWholeTrackerGaps } from "@/lib/wholeTrackerGaps";
import { loadSkills } from "@/lib/skills";
import { generateJson } from "@/lib/gemini";
import { questionDraftResponseSchema } from "@/lib/validation/synthesis";
import { deliverQuestion } from "@/lib/questionDelivery";

export type DraftQuestionsResult =
  | { ok: true; questionCount: number }
  | { ok: false; error: string };

function buildPrompt(trackerName: string, gaps: Gap[], stakeholders: { id: string; name: string; ownsWhat: string | null }[]): string {
  const skill = loadSkills(["draft-stakeholder-question"]);
  return `You are the GovEx curiosity engine. Apply the skill below to the supplied gaps for one tracker, then return ONLY a single JSON object matching the schema at the end. Do not include markdown fences or any text outside the JSON object.

${skill}

## Tracker
${trackerName}

## Stakeholders (use the EXACT "id" for stakeholderId if one is a clear match)

${stakeholders.map((s) => `- id="${s.id}" name="${s.name}" ownsWhat="${s.ownsWhat ?? ""}"`).join("\n") || "(no stakeholders recorded)"}

## Gaps to turn into questions (use the EXACT "targetSummary" string back in your response so we can match your question to the right gap)

${gaps.map((g, i) => `${i + 1}. targetSummary="${g.targetSummary}"\n   reason: ${g.rationale}`).join("\n")}

## Required JSON output schema

{ "questions": [ { "targetSummary": string, "questionText": string, "stakeholderId": string (optional) } ] }`;
}

export async function draftQuestions(trackerId: string, orgId: string): Promise<DraftQuestionsResult> {
  const tracker = await prisma.tracker.findFirst({ where: { id: trackerId, orgId }, select: { id: true, name: true } });
  if (!tracker) return { ok: false, error: "Tracker not found." };

  // Two independent gap sources feeding the same pipeline: the cheap
  // deterministic field checks, and the broader whole-tracker reasoning
  // agent (skills/whole-tracker-gap-detection.md) — run alongside each
  // other, neither replaces the other.
  const [ruleGaps, aiGaps] = await Promise.all([detectGaps(trackerId), detectWholeTrackerGaps(trackerId, orgId)]);
  const allGaps = [...ruleGaps, ...aiGaps];
  const notAlreadyAsked = await filterAlreadyAsked(trackerId, allGaps);
  const gaps = await filterDisabledPatterns(orgId, notAlreadyAsked);
  if (gaps.length === 0) return { ok: true, questionCount: 0 };

  const stakeholders = await prisma.stakeholder.findMany({ where: { trackerId }, select: { id: true, name: true, ownsWhat: true } });
  const primaryStakeholder = await prisma.stakeholder.findFirst({ where: { trackerId, isPrimary: true } });

  let raw: string;
  try {
    raw = await generateJson(buildPrompt(tracker.name, gaps, stakeholders));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Gemini API error.";
    return { ok: false, error: `Gemini call failed: ${message}` };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Gemini did not return valid JSON." };
  }

  const parsed = questionDraftResponseSchema.safeParse(parsedJson);
  if (!parsed.success) return { ok: false, error: "Gemini response failed validation." };

  // Match drafted questions back to gaps by targetSummary; fall back to a
  // generic phrasing for any gap Gemini skipped, so nothing silently drops.
  const byTarget = new Map(parsed.data.questions.map((q) => [q.targetSummary, q]));
  const validStakeholderIds = new Set(stakeholders.map((s) => s.id));

  // Created individually (not createMany) so each row's id is available to
  // auto-send immediately — fully autonomous per the user's explicit choice,
  // no manual "Approve & Send" click required.
  for (const g of gaps) {
    const drafted = byTarget.get(g.targetSummary);
    const stakeholderId = drafted?.stakeholderId && validStakeholderIds.has(drafted.stakeholderId) ? drafted.stakeholderId : (primaryStakeholder?.id ?? null);

    const created = await prisma.openQuestion.create({
      data: {
        trackerId,
        stakeholderId,
        questionPattern: g.pattern,
        targetSummary: g.targetSummary,
        questionText: drafted?.questionText ?? `Can you provide an update on: ${g.targetSummary}?`,
        rationale: g.rationale,
        source: "GEMINI",
      },
    });

    try {
      await deliverQuestion(created.id, "system:auto-draft");
    } catch (err) {
      console.error("[draftQuestions] auto-send failed for", created.id, err instanceof Error ? err.message : err);
    }
  }

  return { ok: true, questionCount: gaps.length };
}
