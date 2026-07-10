import { z } from "zod";
import { INSIGHT_SIGNAL, TACTIC_STATUS } from "@/lib/enums";

const signal = z.enum(INSIGHT_SIGNAL);

// Response shape for skills/tactic-update-insight.md — either insight may be
// null (the update might only support one, or neither if it's off-topic).
export const tacticUpdateInsightSchema = z.object({
  executionInsight: z.object({ signal, text: z.string().min(1) }).nullable(),
  outcomeInsight: z.object({ signal, text: z.string().min(1) }).nullable(),
  suggestedStatus: z.enum(TACTIC_STATUS).nullable(),
  rationale: z.string().default(""),
});

// Response shape for the direct (no-ingestion-events) Strategy-vs-Outcome
// generation, reusing skills/tracker-synthesis.md but grounded on the
// tracker's current structured draft data instead of raw ingestion events.
export const strategyVsOutcomeDraftSchema = z.object({
  insights: z
    .array(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .default([]),
});
