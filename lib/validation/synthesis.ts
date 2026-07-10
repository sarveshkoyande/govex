import { z } from "zod";
import { INSIGHT_SIGNAL, CLARIFICATION_PATTERN } from "@/lib/enums";

const signal = z.enum(INSIGHT_SIGNAL).default("NONE");
const confidence = z.number().int().min(0).max(100).default(50);

export const tacticSuggestionSchema = z.object({
  tacticId: z.string().min(1),
  kind: z.enum(["TACTIC_EXECUTION", "TACTIC_OUTCOME"]),
  text: z.string().min(1),
  signal,
  confidence,
  rationale: z.string().optional().default(""),
  sourceEventIds: z.array(z.string()).optional().default([]),
});

export const strategySuggestionSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
  signal,
  confidence,
  rationale: z.string().optional().default(""),
  sourceEventIds: z.array(z.string()).optional().default([]),
});

// "Building a brain" — Gemini flags its own confusion during synthesis,
// distinct from the rule-based gaps in lib/gaps.ts. See skills/detect-clarifications.md.
export const clarificationSchema = z.object({
  confusionType: z.enum(CLARIFICATION_PATTERN),
  topic: z.string().min(1),
  question: z.string().min(1),
  rationale: z.string().optional().default(""),
  sourceEventIds: z.array(z.string()).optional().default([]),
  stakeholderId: z.string().optional(),
});

// Stage 3 — whole-tracker gap detection response shape (skills/whole-tracker-gap-detection.md).
// Separate from the rule-based Gap in lib/gaps.ts, but both get mapped into
// that same shape before feeding the shared dedupe/draft/send pipeline.
export const wholeTrackerGapSchema = z.object({
  targetSummary: z.string().min(1),
  rationale: z.string().min(1),
});
export const wholeTrackerGapResponseSchema = z.object({
  gaps: z.array(wholeTrackerGapSchema).max(5).default([]),
});

// Top-level shape Gemini must return for a synthesis run.
export const synthesisResponseSchema = z.object({
  strategyInsights: z.array(strategySuggestionSchema).default([]),
  tacticInsights: z.array(tacticSuggestionSchema).default([]),
  clarifications: z.array(clarificationSchema).default([]),
});

export type SynthesisResponse = z.infer<typeof synthesisResponseSchema>;

// Stage 3 — question drafting response shape.
export const questionDraftSchema = z.object({
  targetSummary: z.string().min(1),
  questionText: z.string().min(1),
  stakeholderId: z.string().optional(),
});
export const questionDraftResponseSchema = z.object({
  questions: z.array(questionDraftSchema).default([]),
});
export type QuestionDraftResponse = z.infer<typeof questionDraftResponseSchema>;

// Stage 4 — answer evaluation response shape.
export const answerEvaluationSchema = z.object({
  verdict: z.enum(["USEFUL", "NON_ANSWER"]),
  reasoning: z.string().min(1),
});
export type AnswerEvaluation = z.infer<typeof answerEvaluationSchema>;
