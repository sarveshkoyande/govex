import { prisma } from "@/lib/db";
import { loadSkill } from "@/lib/skills";
import { generateJson } from "@/lib/gemini";
import { conceptPageCompilationSchema } from "@/lib/validation/conceptPage";

// ===========================================================================
// Concept-page layer (OpenKB parity). One continuously-updated narrative page
// per distinct entity, compiled automatically on ingest from the accumulated
// EntityMention snippets for that subject. This is what lets chat read a
// pre-compiled page instead of re-deriving every answer live from raw search.
//
// Subjects come in four types, mapped from the entity registry:
//   STAKEHOLDER   -> a Stakeholder row      (person)
//   MICROBATTLE   -> a MicroBattle row      (project/workstream)
//   ORGANIZATION  -> an ExternalOrg row     (external company/vendor/agency)
//   TERM          -> a glossary/OrgTerm     (system/acronym/product — no id row)
// See lib/entityExtraction.ts / lib/entityRegistry.ts for how these are
// extracted and promoted; this module reads the mentions they produce.
// ===========================================================================

export type ConceptSubjectType = "STAKEHOLDER" | "MICROBATTLE" | "TERM" | "ORGANIZATION";

export interface ConceptSubject {
  subjectType: ConceptSubjectType;
  subjectId: string | null; // set for STAKEHOLDER/MICROBATTLE/ORGANIZATION, null for TERM
  subjectTerm: string | null; // set for TERM, null otherwise
  title: string; // human name — stakeholder/microbattle/org name, or the term itself
  trackerId: string | null;
}

// The always-non-null identity used for the ConceptPage unique constraint.
// Id-backed subjects key on their id; TERM keys on the lowercased term (a term
// has no row of its own, and casing varies across mentions).
function subjectKey(s: ConceptSubject): string {
  return s.subjectType === "TERM"
    ? `TERM:${(s.subjectTerm ?? "").toLowerCase()}`
    : `${s.subjectType}:${s.subjectId}`;
}

// The mentions this app records point at registry entities via targetType. Map
// the in-scope ones to a concept subject; skip TRACKER (already richly served
// by get_tracker_details) and UNRESOLVED (not yet a real entity — a one-off
// mention with no identity to compile a page around; it only becomes a subject
// once promoted, at which point future events record it as one of the four
// registry types above).
async function subjectFromMention(
  m: { targetType: string; targetId: string | null; targetTerm: string | null; trackerId: string | null },
): Promise<ConceptSubject | null> {
  switch (m.targetType) {
    case "STAKEHOLDER": {
      if (!m.targetId) return null;
      const s = await prisma.stakeholder.findUnique({ where: { id: m.targetId }, select: { name: true, trackerId: true } });
      if (!s) return null;
      return { subjectType: "STAKEHOLDER", subjectId: m.targetId, subjectTerm: null, title: s.name, trackerId: s.trackerId };
    }
    case "MICROBATTLE": {
      if (!m.targetId) return null;
      const mb = await prisma.microBattle.findUnique({ where: { id: m.targetId }, select: { name: true, trackerId: true } });
      if (!mb) return null;
      return { subjectType: "MICROBATTLE", subjectId: m.targetId, subjectTerm: null, title: mb.name, trackerId: mb.trackerId };
    }
    case "ORGANIZATION": {
      if (!m.targetId) return null;
      const eo = await prisma.externalOrg.findUnique({ where: { id: m.targetId }, select: { name: true } });
      if (!eo) return null;
      return { subjectType: "ORGANIZATION", subjectId: m.targetId, subjectTerm: null, title: eo.name, trackerId: m.trackerId };
    }
    case "TERM": {
      if (!m.targetTerm) return null;
      return { subjectType: "TERM", subjectId: null, subjectTerm: m.targetTerm, title: m.targetTerm, trackerId: m.trackerId };
    }
    default:
      return null; // TRACKER, UNRESOLVED, anything else
  }
}

// Tracker-owned subject types (a person/workstream belongs to exactly one
// tracker). For these, a page is scoped to that tracker: it's only ever
// compiled from — and by events on — its own tracker. TERM/ORGANIZATION are
// genuinely cross-tracker (a glossary term or external vendor recurs across
// engagements) and stay org-wide.
function isTrackerScoped(t: ConceptSubjectType): boolean {
  return t === "STAKEHOLDER" || t === "MICROBATTLE";
}

// Which entities did THIS event mention that deserve a (re)compiled page?
// Reads the event's own EntityMention rows and resolves each to a subject,
// deduped by subjectKey. Deliberately reads mentions rather than re-parsing
// text — extraction already did the grounded work; this just aggregates it.
//
// Dictionary matching is org-wide, so an event on tracker A that names "Vivek
// Ghai" also records a mention against a *different* same-named stakeholder
// row on tracker B. We must NOT build (or recompile) B's page from an A event
// — that would leak A's content into B's page. So a tracker-scoped subject is
// only produced when its own tracker matches this event's tracker.
export async function resolveSubjectsForEvent(orgId: string, eventId: string): Promise<ConceptSubject[]> {
  const [event, mentions] = await Promise.all([
    prisma.rawIngestionEvent.findUnique({ where: { id: eventId }, select: { trackerId: true } }),
    prisma.entityMention.findMany({
      where: { orgId, sourceType: "RAW_EVENT", sourceId: eventId },
      select: { targetType: true, targetId: true, targetTerm: true, trackerId: true },
    }),
  ]);
  const eventTrackerId = event?.trackerId ?? null;

  const byKey = new Map<string, ConceptSubject>();
  for (const m of mentions) {
    const subject = await subjectFromMention(m);
    if (!subject) continue;
    if (isTrackerScoped(subject.subjectType) && subject.trackerId !== eventTrackerId) continue;
    byKey.set(subjectKey(subject), subject);
  }
  return [...byKey.values()];
}

// Every mention of this subject across the whole org — the full evidence base
// for its page. For id-backed subjects that also folds in any historical
// UNRESOLVED mentions recorded under the same name BEFORE the entity was
// promoted (those snippets are real signal about the same entity, just from
// when it had no id yet). Only RAW_EVENT sources count toward sourceEventIds.
async function gatherEvidence(orgId: string, subject: ConceptSubject) {
  const or: object[] = [];
  if (subject.subjectId) {
    or.push({ targetType: subject.subjectType, targetId: subject.subjectId });
    or.push({ targetType: "UNRESOLVED", targetTerm: { equals: subject.title, mode: "insensitive" } });
  } else if (subject.subjectTerm) {
    or.push({ targetType: "TERM", targetTerm: { equals: subject.subjectTerm, mode: "insensitive" } });
    or.push({ targetType: "UNRESOLVED", targetTerm: { equals: subject.subjectTerm, mode: "insensitive" } });
  }

  const mentions = await prisma.entityMention.findMany({
    where: { orgId, OR: or },
    select: { contextSnippet: true, sourceType: true, sourceId: true, trackerId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // For a tracker-scoped subject, keep only mentions whose source belongs to
  // that subject's own tracker — org-wide dictionary matching otherwise pulls
  // in a same-named entity's mentions from unrelated trackers (see
  // resolveSubjectsForEvent). Resolve each mention's tracker from its source.
  let scoped = mentions;
  if (isTrackerScoped(subject.subjectType) && subject.trackerId) {
    const rawIds = mentions.filter((m) => m.sourceType === "RAW_EVENT").map((m) => m.sourceId);
    const stratIds = mentions.filter((m) => m.sourceType === "STRATEGY_INSIGHT").map((m) => m.sourceId);
    const tacticIds = mentions.filter((m) => m.sourceType === "TACTIC_INSIGHT").map((m) => m.sourceId);
    const [rawEvents, stratInsights, tacticInsights] = await Promise.all([
      rawIds.length ? prisma.rawIngestionEvent.findMany({ where: { id: { in: rawIds } }, select: { id: true, trackerId: true } }) : [],
      stratIds.length ? prisma.strategyInsight.findMany({ where: { id: { in: stratIds } }, select: { id: true, trackerId: true } }) : [],
      tacticIds.length ? prisma.tacticInsight.findMany({ where: { id: { in: tacticIds } }, select: { id: true, tactic: { select: { microBattle: { select: { trackerId: true } } } } } }) : [],
    ]);
    const rawMap = new Map(rawEvents.map((e) => [e.id, e.trackerId]));
    const stratMap = new Map(stratInsights.map((e) => [e.id, e.trackerId]));
    const tacticMap = new Map(tacticInsights.map((e) => [e.id, e.tactic.microBattle.trackerId]));
    scoped = mentions.filter((m) => {
      let t: string | null = null;
      if (m.sourceType === "RAW_EVENT") t = rawMap.get(m.sourceId) ?? m.trackerId;
      else if (m.sourceType === "STRATEGY_INSIGHT") t = stratMap.get(m.sourceId) ?? null;
      else if (m.sourceType === "TACTIC_INSIGHT") t = tacticMap.get(m.sourceId) ?? null;
      return t === subject.trackerId;
    });
  }

  const snippets = scoped.map((m) => m.contextSnippet).filter(Boolean);
  const sourceEventIds = [...new Set(scoped.filter((m) => m.sourceType === "RAW_EVENT").map((m) => m.sourceId))];
  return { snippets, sourceEventIds };
}

function buildCompilationPrompt(subject: ConceptSubject, previousNarrative: string | null, snippets: string[]): string {
  const skill = loadSkill("concept-page-compilation");
  const typeLabel = {
    STAKEHOLDER: "person (stakeholder)",
    MICROBATTLE: "project / workstream",
    ORGANIZATION: "external organization",
    TERM: "system / term / concept",
  }[subject.subjectType];

  return `${skill}

## Entity
name="${subject.title}"
type=${typeLabel}

## Previous narrative (established memory — preserve what still holds, revise what's superseded)
${previousNarrative ? previousNarrative : "(none yet — this is the first compile for this entity)"}

## Mention snippets (${snippets.length} total, oldest first — the grounded evidence)
${snippets.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Required JSON output schema
{ "narrative": string, "contradictions": [ { "claim": string, "conflictingSources": string, "note": string } ], "mentionCount": number }

Return ONLY the JSON object, no markdown fences, no other text.`;
}

// Compile (or recompile) one subject's page. Auto-publishes: bumps version,
// merges source events, writes the fresh narrative + contradictions. On any
// failure (Gemini error, invalid JSON, schema mismatch) it keeps the existing
// page untouched rather than clobbering it — same "never write garbage"
// discipline as the rest of the AI-write paths in this app.
export async function compileConceptPage(orgId: string, subject: ConceptSubject): Promise<{ compiled: boolean }> {
  const key = subjectKey(subject);
  const existing = await prisma.conceptPage.findUnique({ where: { orgId_subjectKey: { orgId, subjectKey: key } } });

  const { snippets, sourceEventIds } = await gatherEvidence(orgId, subject);
  if (snippets.length === 0) return { compiled: false }; // nothing grounded to write

  let raw: string;
  try {
    raw = await generateJson(buildCompilationPrompt(subject, existing?.narrative ?? null, snippets));
  } catch (err) {
    console.error("[compileConceptPage] Gemini call failed for", subject.title, err instanceof Error ? err.message : err);
    return { compiled: false };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { compiled: false };
  }

  const result = conceptPageCompilationSchema.safeParse(parsedJson);
  if (!result.success) return { compiled: false };

  const { narrative, contradictions } = result.data;

  // Preserve a human's verification when the content is genuinely unchanged;
  // if it was verified and the narrative just moved, mark STALE rather than
  // silently overwriting the human's sign-off with a fresh AI_COMPILED.
  let verificationStatus = "AI_COMPILED";
  if (existing?.verificationStatus === "HUMAN_VERIFIED") {
    verificationStatus = existing.narrative === narrative ? "HUMAN_VERIFIED" : "STALE";
  }

  await prisma.conceptPage.upsert({
    where: { orgId_subjectKey: { orgId, subjectKey: key } },
    create: {
      orgId,
      subjectKey: key,
      trackerId: subject.trackerId,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      subjectTerm: subject.subjectTerm,
      title: subject.title,
      narrative,
      sourceEventIds: JSON.stringify(sourceEventIds),
      mentionCount: snippets.length,
      contradictions: JSON.stringify(contradictions),
      verificationStatus,
    },
    update: {
      trackerId: subject.trackerId ?? existing?.trackerId ?? null,
      title: subject.title,
      narrative,
      sourceEventIds: JSON.stringify(sourceEventIds),
      mentionCount: snippets.length,
      contradictions: JSON.stringify(contradictions),
      verificationStatus,
      version: { increment: 1 },
      lastCompiledAt: new Date(),
    },
  });

  return { compiled: true };
}

// Entry point wired into ingestion (lib/ingestion.ts). Recompiles a page for
// every entity mentioned in the just-ingested event. Per-subject try/catch so
// one failure never blocks the rest — same fire-and-forget discipline as
// autoPromoteEntityCandidates, which this runs right after.
export async function compileConceptPagesForEvent(orgId: string, eventId: string): Promise<void> {
  const subjects = await resolveSubjectsForEvent(orgId, eventId);
  for (const subject of subjects) {
    try {
      await compileConceptPage(orgId, subject);
    } catch (err) {
      console.error("[compileConceptPagesForEvent] failed to compile", subject.title, err instanceof Error ? err.message : err);
    }
  }
}

// Full org-wide rebuild — drops all existing pages and recompiles one per
// distinct entity from the current mention set. The counterpart to
// rebuildDictionaryMentions / rebuildConceptualMentions (lib/entityExtraction.ts):
// safe to run anytime (e.g. after a compile-logic change, or an admin
// "Rebuild pages" action) since every page is derived, never hand-authored.
// Note this resets any HUMAN_VERIFIED status — a full rebuild is a deliberate
// "recompile everything from scratch," so that's expected.
export async function recompileAllConceptPages(orgId: string): Promise<{ subjects: number; compiled: number }> {
  await prisma.conceptPage.deleteMany({ where: { orgId } });

  const mentions = await prisma.entityMention.findMany({
    where: { orgId, targetType: { in: ["STAKEHOLDER", "MICROBATTLE", "TERM", "ORGANIZATION"] } },
    select: { targetType: true, targetId: true, targetTerm: true, trackerId: true },
  });

  const byKey = new Map<string, ConceptSubject>();
  for (const m of mentions) {
    const subject = await subjectFromMention(m);
    if (subject) byKey.set(subjectKey(subject), subject);
  }

  let compiled = 0;
  for (const subject of byKey.values()) {
    try {
      const r = await compileConceptPage(orgId, subject);
      if (r.compiled) compiled++;
    } catch (err) {
      console.error("[recompileAllConceptPages] failed to compile", subject.title, err instanceof Error ? err.message : err);
    }
  }
  return { subjects: byKey.size, compiled };
}
