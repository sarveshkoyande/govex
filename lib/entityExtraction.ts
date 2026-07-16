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

      // Word-boundary match, not raw substring — a plain indexOf lets short
      // aliases like "GAIN" false-positive-match inside ordinary words
      // (e.g. "against" contains "gain"). \b doesn't fire on a leading
      // digit/hyphen boundary reliably for terms like "3-in-a-box", so fall
      // back to substring only for aliases containing non-word characters.
      const hasWordChars = /^[\w\s]+$/.test(alias);
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const idx = hasWordChars
        ? lowerText.search(new RegExp(`\\b${escaped}\\b`))
        : lowerText.indexOf(alias);
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
// scoped CONTEXT_DOC event. Uses the FULL ingested note text, not the short
// auto-summary: the context docs run 13-20k characters of real strategy,
// financial, and outcome detail (the "note" for that vertical, Obsidian-
// style), and a ~1000-char summary was throwing almost all of that away
// before Gemini ever saw it — which is why conceptual links were shallow
// ("both involve AI") instead of grounded in the actual specifics. For
// TRACKER-scoped themes, also fold in StrategyInsight titles/descriptions
// and headline financials (budget/spend/forecast), which live in
// structured tables the context doc's own text doesn't repeat but are
// exactly the kind of "strategy outcomes vs. finance" detail worth
// comparing across themes. Themes without a context doc yet are simply
// not included; nothing to link from.
async function buildProfiles(orgId: string): Promise<Profile[]> {
  const events = await prisma.rawIngestionEvent.findMany({
    where: {
      source: "CONTEXT_DOC",
      OR: [{ tracker: { orgId } }, { domain: { orgId } }],
    },
    select: {
      id: true,
      summary: true,
      rawText: true,
      trackerId: true,
      domainId: true,
      tracker: { select: { name: true, strategyInsights: { select: { title: true, description: true } }, budget: true, spend: true, forecast: true } },
      domain: { select: { name: true } },
    },
  });

  return events
    .map((e): Profile | null => {
      const noteText = e.rawText ?? e.summary ?? "";
      if (!noteText) return null;

      if (e.trackerId && e.tracker) {
        const strategyLines = e.tracker.strategyInsights
          .map((s) => `- ${s.title}${s.description ? `: ${s.description}` : ""}`)
          .join("\n");
        const financials = [
          e.tracker.budget != null ? `Budget: $${e.tracker.budget}` : null,
          e.tracker.spend != null ? `Spend: $${e.tracker.spend}` : null,
          e.tracker.forecast != null ? `Forecast: $${e.tracker.forecast}` : null,
        ].filter(Boolean).join(", ");

        const enriched = [
          noteText,
          strategyLines ? `\n\nStrategy outcomes:\n${strategyLines}` : "",
          financials ? `\n\nFinancials: ${financials}` : "",
        ].join("");
        return { eventId: e.id, targetType: "TRACKER", targetId: e.trackerId, name: e.tracker.name, summary: enriched };
      }
      if (e.domainId && e.domain) return { eventId: e.id, targetType: "DOMAIN", targetId: e.domainId, name: e.domain.name, summary: noteText };
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

    // Gemini has, in practice, ignored the skill's "don't force connections"
    // instruction and returned a connection to nearly every other theme at
    // 80-98% confidence — i.e. everything connects to everything, which is
    // exactly the generic-noise failure mode the skill explicitly warns
    // against. A prompt already failed to prevent this once, so enforce it
    // in code: require genuinely high confidence, and cap to the single
    // strongest connection — a theme has at most one standout thematic
    // relative, not four.
    const validIds = new Set(others.map((o) => o.targetId));
    const strongConnections = result.data.connections
      .filter((c) => c.confidence >= 92 && validIds.has(c.targetId))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 1);

    for (const conn of strongConnections) {
      const target = others.find((o) => o.targetId === conn.targetId)!;

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
