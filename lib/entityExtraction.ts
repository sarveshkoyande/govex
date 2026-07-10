import { prisma } from "@/lib/db";
import { buildRegistry } from "@/lib/entityRegistry";
import { loadSkill } from "@/lib/skills";
import { generateJson } from "@/lib/gemini";
import { conceptualLinkResponseSchema } from "@/lib/validation/entityMention";

export type MentionSourceType = "RAW_EVENT" | "STRATEGY_INSIGHT" | "TACTIC_INSIGHT";

const SNIPPET_RADIUS = 80;

function extractSnippet(text: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(text.length, matchIndex + matchLength + SNIPPET_RADIUS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end).trim() + suffix;
}

// Deterministic, free, zero-hallucination-risk tier: substring-match the
// text against the closed registry (lib/entityRegistry.ts). Excludes a
// self-reference (a tracker's own text "mentioning" itself isn't a graph
// edge worth recording — see selfTrackerId/selfDomainId).
export async function extractDictionaryMentions(
  orgId: string,
  sourceType: MentionSourceType,
  sourceId: string,
  text: string,
  selfTrackerId?: string | null,
): Promise<void> {
  const registry = await buildRegistry(orgId);
  const lowerText = text.toLowerCase();
  const seen = new Set<string>(); // dedupe multiple hits of the same alias in one doc

  for (const entry of registry) {
    if (entry.targetType === "TRACKER" && entry.targetId === selfTrackerId) continue; // no self-edges

    for (const alias of entry.aliases) {
      if (alias.length < 3) continue; // guard against near-universal short strings
      const key = `${entry.targetType}:${entry.targetId ?? entry.targetTerm}`;
      if (seen.has(key)) break;

      const idx = lowerText.indexOf(alias);
      if (idx === -1) continue;
      seen.add(key);

      await prisma.entityMention.create({
        data: {
          orgId,
          sourceType,
          sourceId,
          targetType: entry.targetType,
          targetId: entry.targetId,
          targetTerm: entry.targetTerm,
          method: "DICTIONARY",
          contextSnippet: extractSnippet(text, idx, alias.length),
          confidence: 100,
        },
      });
    }
  }
}

// Removes previously-recorded dictionary mentions for one source before
// re-extracting — makes the function safely re-runnable (e.g. if content
// was edited) instead of accumulating duplicates.
export async function clearDictionaryMentions(sourceType: MentionSourceType, sourceId: string): Promise<void> {
  await prisma.entityMention.deleteMany({ where: { sourceType, sourceId, method: "DICTIONARY" } });
}

// StrategyInsight/TacticInsight get created from several different code
// paths (synthesis approval, manual tracker-form save, tactic-update-insight)
// — rather than threading extraction hooks through every one of them, this
// does a full rescan on demand. Cheap (pure string matching, no Gemini) and
// safe to re-run anytime (e.g. an admin "Rebuild" button, or after a bulk
// content change) rather than needing per-write-path wiring to stay correct.
export async function rebuildDictionaryMentions(orgId: string): Promise<{ count: number }> {
  await prisma.entityMention.deleteMany({ where: { orgId, method: "DICTIONARY" } });

  const [rawEvents, strategyInsights, tacticInsights] = await Promise.all([
    prisma.rawIngestionEvent.findMany({
      where: { OR: [{ tracker: { orgId } }, { domain: { orgId } }] },
      select: { id: true, rawText: true, trackerId: true },
    }),
    prisma.strategyInsight.findMany({
      where: { tracker: { orgId } },
      select: { id: true, description: true, trackerId: true },
    }),
    prisma.tacticInsight.findMany({
      where: { tactic: { microBattle: { tracker: { orgId } } } },
      select: { id: true, text: true, tactic: { select: { microBattle: { select: { trackerId: true } } } } },
    }),
  ]);

  for (const e of rawEvents) {
    if (e.rawText) await extractDictionaryMentions(orgId, "RAW_EVENT", e.id, e.rawText, e.trackerId);
  }
  for (const s of strategyInsights) {
    if (s.description) await extractDictionaryMentions(orgId, "STRATEGY_INSIGHT", s.id, s.description, s.trackerId);
  }
  for (const t of tacticInsights) {
    if (t.text) await extractDictionaryMentions(orgId, "TACTIC_INSIGHT", t.id, t.text, t.tactic.microBattle.trackerId);
  }

  const count = await prisma.entityMention.count({ where: { orgId, method: "DICTIONARY" } });
  return { count };
}

interface Profile {
  eventId: string; // the CONTEXT_DOC RawIngestionEvent this profile's summary came from — mentions are recorded against it
  targetType: "TRACKER" | "DOMAIN";
  targetId: string;
  name: string;
  summary: string;
}

// One profile per theme with a context-doc brief — its trackerId/domainId
// scoped CONTEXT_DOC event, using the already-generated summary (not full
// text) as what gets compared. Themes without a context doc yet are simply
// not included; nothing to link from.
async function buildProfiles(orgId: string): Promise<Profile[]> {
  const events = await prisma.rawIngestionEvent.findMany({
    where: {
      source: "CONTEXT_DOC",
      summary: { not: null },
      OR: [{ tracker: { orgId } }, { domain: { orgId } }],
    },
    select: { id: true, summary: true, trackerId: true, domainId: true, tracker: { select: { name: true } }, domain: { select: { name: true } } },
  });

  return events
    .map((e): Profile | null => {
      if (e.trackerId && e.tracker) return { eventId: e.id, targetType: "TRACKER", targetId: e.trackerId, name: e.tracker.name, summary: e.summary! };
      if (e.domainId && e.domain) return { eventId: e.id, targetType: "DOMAIN", targetId: e.domainId, name: e.domain.name, summary: e.summary! };
      return null;
    })
    .filter((p): p is Profile => p !== null);
}

function buildConceptualPrompt(source: Profile, others: Profile[]): string {
  const skill = loadSkill("entity-conceptual-linking");
  return `${skill}

## This theme's profile

id="${source.targetId}" name="${source.name}"
${source.summary}

## Every other theme in the org (potential connection targets)

${others.map((o) => `- id="${o.targetId}" name="${o.name}"\n  ${o.summary}`).join("\n\n")}

## Required JSON output schema

{ "connections": [ { "targetId": string, "reasoning": string, "confidence": number (0-100) } ] }

targetId must be one of the exact ids listed above. Return ONLY the JSON object, no markdown fences, no other text.`;
}

// The Gemini-backed tier — thematic connections with no shared vocabulary,
// which dictionary matching structurally cannot find (see skills/entity-conceptual-linking.md).
// One call per theme-with-a-context-doc, each comparing against the full
// catalog of the others in a single prompt — not O(n^2) pairwise calls.
export async function rebuildConceptualMentions(orgId: string): Promise<{ count: number; errors: number }> {
  const profiles = await buildProfiles(orgId);
  let errors = 0;

  for (const source of profiles) {
    await prisma.entityMention.deleteMany({ where: { sourceType: "RAW_EVENT", sourceId: source.eventId, method: "CONCEPTUAL" } });

    const others = profiles.filter((p) => p.eventId !== source.eventId);
    if (others.length === 0) continue;

    let raw: string;
    try {
      raw = await generateJson(buildConceptualPrompt(source, others));
    } catch (err) {
      console.error("[rebuildConceptualMentions] Gemini call failed for", source.name, err instanceof Error ? err.message : err);
      errors++;
      continue;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      errors++;
      continue;
    }

    const result = conceptualLinkResponseSchema.safeParse(parsedJson);
    if (!result.success) {
      errors++;
      continue;
    }

    const validIds = new Set(others.map((o) => o.targetId));
    for (const conn of result.data.connections) {
      const target = others.find((o) => o.targetId === conn.targetId);
      if (!target || !validIds.has(conn.targetId)) continue; // drop hallucinated ids rather than crash the run

      await prisma.entityMention.create({
        data: {
          orgId,
          sourceType: "RAW_EVENT",
          sourceId: source.eventId,
          targetType: target.targetType,
          targetId: target.targetId,
          method: "CONCEPTUAL",
          contextSnippet: target.name,
          confidence: conn.confidence,
          reasoning: conn.reasoning,
        },
      });
    }
  }

  const count = await prisma.entityMention.count({ where: { orgId, method: "CONCEPTUAL" } });
  return { count, errors };
}
