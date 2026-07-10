import { prisma } from "@/lib/db";

// Rule-based gap detection — the "does it know it doesn't know" half of the
// curiosity loop (Section 2.3). Deliberately simple and deterministic; Gemini
// only phrases the question (lib/questions.ts), it never decides what's
// missing. Keep this list of detectors small and add more only as concrete
// needs arise — don't build speculative detectors.

export interface Gap {
  // AI_WHOLE_TRACKER_GAP comes from lib/wholeTrackerGaps.ts — a separate,
  // broader-reasoning agent that feeds this same Gap shape and pipeline.
  pattern: "STALE_FIELD" | "NO_MITIGATION" | "MISSING_RATIONALE" | "AI_WHOLE_TRACKER_GAP";
  targetSummary: string;
  rationale: string;
}

// filterAlreadyAsked/filterDisabledPatterns only need pattern+targetSummary,
// so lib/synthesis.ts reuses them for Gemini-detected clarifications too —
// same dedupe and same learning-loop respect, one implementation.
interface PatternedItem {
  pattern: string;
  targetSummary: string;
}

const STALE_DAYS_DEFAULT = 30;

export async function detectGaps(trackerId: string): Promise<Gap[]> {
  const [staleFields, openRisksNoMitigation, decisionsNoRationale] = await Promise.all([
    prisma.fieldState.findMany({ where: { trackerId } }),
    prisma.risk.findMany({ where: { trackerId, status: "Open", OR: [{ mitigation: null }, { mitigation: "" }] } }),
    prisma.decisionLogEntry.findMany({ where: { trackerId, OR: [{ rationale: null }, { rationale: "" }] } }),
  ]);

  const gaps: Gap[] = [];
  const now = Date.now();

  for (const f of staleFields) {
    const ageDays = (now - f.lastUpdatedAt.getTime()) / (1000 * 60 * 60 * 24);
    const staleAfter = f.staleAfterDays || STALE_DAYS_DEFAULT;
    if (ageDays > staleAfter) {
      gaps.push({
        pattern: "STALE_FIELD",
        targetSummary: `Field "${f.fieldKey}" on ${f.entityType} — last updated ${Math.round(ageDays)} days ago`,
        rationale: `This field hasn't been updated in ${Math.round(ageDays)} days, past its ${staleAfter}-day staleness threshold.`,
      });
    }
  }

  for (const r of openRisksNoMitigation) {
    gaps.push({
      pattern: "NO_MITIGATION",
      targetSummary: `Risk: ${r.title}`,
      rationale: `This risk is Open with severity ${r.severity} but has no recorded mitigation plan.`,
    });
  }

  for (const d of decisionsNoRationale) {
    gaps.push({
      pattern: "MISSING_RATIONALE",
      targetSummary: `Decision: ${d.decision}`,
      rationale: `This decision was logged without a recorded rationale.`,
    });
  }

  return gaps;
}

// Avoid re-asking about the same gap while a prior question about it is still
// live (not yet answered or dismissed).
export async function filterAlreadyAsked<T extends PatternedItem>(trackerId: string, items: T[]): Promise<T[]> {
  const existing = await prisma.openQuestion.findMany({
    where: { trackerId, status: { in: ["DRAFT", "APPROVED", "ASKED"] } },
    select: { questionPattern: true, targetSummary: true },
  });
  const existingKeys = new Set(existing.map((e) => `${e.questionPattern}::${e.targetSummary}`));
  return items.filter((g) => !existingKeys.has(`${g.pattern}::${g.targetSummary}`));
}

// Stage 4 — the learning loop: don't keep drafting questions for a pattern
// that historically produces non-answers. Disabled patterns are still fully
// visible/reversible in Settings → Question Patterns, never silently gone.
export async function filterDisabledPatterns<T extends PatternedItem>(orgId: string, items: T[]): Promise<T[]> {
  const disabled = await prisma.questionPatternStats.findMany({
    where: { orgId, enabled: false },
    select: { questionPattern: true },
  });
  if (disabled.length === 0) return items;
  const disabledSet = new Set(disabled.map((d) => d.questionPattern));
  return items.filter((g) => !disabledSet.has(g.pattern));
}
