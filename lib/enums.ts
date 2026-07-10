// App-level enums. SQLite has no native enums, so these String constants are
// the single source of truth and are enforced by the zod schemas.

export const ROLES = [
  "EXEC_VIEWER",
  "THEME_OWNER",
  "ACTION_OWNER",
  "CONTENT_ADMIN",
  "PUBLISHER",
  "SYSTEM_ADMIN",
] as const;
export type Role = (typeof ROLES)[number];

export const LIFECYCLE_STATUS = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
export const RAG = ["RED", "AMBER", "GREEN"] as const;
export const SIGNAL_STATUS = ["RISK", "WATCH", "ON_TRACK", "OPPORTUNITY"] as const;

export const RISK_SEVERITY = ["High", "Medium", "Low"] as const;
export const RISK_STATUS = ["Open", "Mitigated", "Closed"] as const;

export const ACTION_PRIORITY = ["high", "medium", "low"] as const;
export const ACTION_STATUS = ["open", "in_progress", "done"] as const;
export const ACTION_ASSIGNEE = ["you", "team"] as const;

export const TACTIC_STATUS = ["Open", "Active", "Done", "TBD"] as const;

// Insight signal taxonomy used by the sample theme components (includes NONE).
export const INSIGHT_SIGNAL = ["RISK", "WATCH", "ON_TRACK", "OPPORTUNITY", "NONE"] as const;
export const INSIGHT_KIND = ["EXECUTION", "OUTCOME"] as const;

export const FINANCIAL_UNIT = ["USD_M", "PCT", "COUNT"] as const;
export const SOURCE = ["MANUAL", "EMAIL", "MEETING", "GEMINI"] as const;

// Stage 1 — ingestion
export const INGESTION_SOURCE = ["EMAIL", "MEETING", "TEAMS", "CONTEXT_DOC"] as const;
export const INGESTION_STATUS = ["RECEIVED", "REVIEWED"] as const;
export const INGESTED_VIA = ["webhook", "manual_test", "system_import"] as const;

// Stage 2 — synthesis
export const SUGGESTION_KIND = ["STRATEGY_INSIGHT", "TACTIC_EXECUTION", "TACTIC_OUTCOME"] as const;
export const SUGGESTION_STATUS = ["PENDING", "APPROVED", "REJECTED"] as const;
export const SYNTHESIS_RUN_STATUS = ["RUNNING", "COMPLETE", "FAILED"] as const;

// Stage 3 — curiosity loop
// Rule-based ("problem") patterns, from lib/gaps.ts:
export const GAP_PATTERN = ["STALE_FIELD", "NO_MITIGATION", "MISSING_RATIONALE", "AI_WHOLE_TRACKER_GAP"] as const;
// Gemini-detected ("clarification") patterns — the model flags its own
// confusion during synthesis, from lib/synthesis.ts + skills/detect-clarifications.md:
export const CLARIFICATION_PATTERN = ["CONTRADICTION", "UNDEFINED_TERM", "UNCLEAR_OWNERSHIP", "UNCLEAR_CONCEPT"] as const;
export const QUESTION_PATTERN = [...GAP_PATTERN, ...CLARIFICATION_PATTERN] as const;
export const QUESTION_STATUS = ["DRAFT", "APPROVED", "ASKED", "ANSWERED", "DISMISSED"] as const;
export const DELIVERY_STATUS = ["SENT", "NOT_CONFIGURED", "FAILED"] as const;

// Stage 4 — learning loop
export const ANSWER_VERDICT = ["USEFUL", "NON_ANSWER"] as const;
// A pattern needs at least this many answered questions before its useful-rate
// is trusted enough to act on — avoids disabling on one unlucky reply.
export const PATTERN_MIN_SAMPLES = 5;
// Below this useful-rate (with enough samples), the pattern auto-disables.
export const PATTERN_DISABLE_THRESHOLD = 0.34;

// Display helpers ---------------------------------------------------------

export const SIGNAL_LABEL: Record<string, string> = {
  RISK: "Risk",
  WATCH: "Watch",
  ON_TRACK: "On Track",
  OPPORTUNITY: "Opportunity",
};

export const RAG_LABEL: Record<string, string> = {
  RED: "Red",
  AMBER: "Amber",
  GREEN: "Green",
};
