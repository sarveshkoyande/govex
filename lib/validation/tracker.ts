import { z } from "zod";
import {
  LIFECYCLE_STATUS, RAG, SIGNAL_STATUS, RISK_SEVERITY, RISK_STATUS,
  ACTION_PRIORITY, ACTION_STATUS, ACTION_ASSIGNEE, TACTIC_STATUS,
  FINANCIAL_UNIT, INSIGHT_SIGNAL,
} from "@/lib/enums";

const oneOf = (vals: readonly string[]) => z.string().refine((v) => vals.includes(v), `must be one of: ${vals.join(", ")}`);

const optionalNumber = z
  .string()
  .transform((v) => (v.trim() === "" ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), "must be a number");

const conf = z.coerce.number().int().min(0).max(100).default(50);

const stakeholder = z.object({
  name: z.string().min(1, "name required"),
  email: z.string().optional().default(""),
  roleOnTracker: z.string().optional().default(""),
  ownsWhat: z.string().optional().default(""),
  isPrimary: z.boolean().default(false),
});

const financial = z.object({
  label: z.string().min(1, "label required"),
  period: z.string().optional().default(""),
  unit: oneOf(FINANCIAL_UNIT).default("USD_M"),
  planned: optionalNumber,
  actual: optionalNumber,
  forecast: optionalNumber,
  confidence: conf,
});

const risk = z.object({
  title: z.string().min(1, "title required"),
  severity: oneOf(RISK_SEVERITY).default("Medium"),
  status: oneOf(RISK_STATUS).default("Open"),
  mitigation: z.string().optional().default(""),
  owner: z.string().optional().default(""),
  confidence: conf,
});

const action = z.object({
  title: z.string().min(1, "title required"),
  owner: z.string().optional().default(""),
  assigneeGroup: oneOf(ACTION_ASSIGNEE).default("you"),
  priority: oneOf(ACTION_PRIORITY).default("medium"),
  status: oneOf(ACTION_STATUS).default("open"),
  dueDate: z.string().optional().default(""),
});

const decision = z.object({
  decision: z.string().min(1, "decision required"),
  rationale: z.string().optional().default(""),
  decidedBy: z.string().optional().default(""),
});

const goal = z.object({ text: z.string().min(1, "goal text required") });

const okr = z.object({
  title: z.string().min(1, "OKR title required"),
  metrics: z.string().optional().default(""),
  tags: z.string().optional().default(""),
});

const insight = z.object({
  signal: oneOf(INSIGHT_SIGNAL).default("NONE"),
  text: z.string().min(1, "insight text required"),
});

const tactic = z.object({
  name: z.string().min(1, "tactic name required"),
  expectedOutcome: z.string().optional().default(""),
  status: oneOf(TACTIC_STATUS).default("Open"),
  executionInsights: z.array(insight).default([]),
  outcomeInsights: z.array(insight).default([]),
});

const microBattle = z.object({
  code: z.string().optional().default(""),
  name: z.string().min(1, "micro-battle name required"),
  ragStatus: oneOf(RAG).default("GREEN"),
  tactics: z.array(tactic).default([]),
});

const strategyInsight = z.object({
  title: z.string().min(1, "insight title required"),
  description: z.string().optional().default(""),
});

export const trackerSchema = z.object({
  id: z.string().optional(),
  domainId: z.string().min(1, "domain required"),
  name: z.string().min(1, "name required"),
  description: z.string().optional().default(""),
  strategyObjective: z.string().optional().default(""),
  okrObjective: z.string().optional().default(""),
  lifecycleStatus: oneOf(LIFECYCLE_STATUS).default("DRAFT"),
  ragStatus: oneOf(RAG).default("GREEN"),
  signalStatus: oneOf(SIGNAL_STATUS).default("ON_TRACK"),
  ownerName: z.string().optional().default(""),
  targetPeriod: z.string().optional().default(""),
  currency: z.string().default("USD"),
  budget: optionalNumber,
  spend: optionalNumber,
  forecast: optionalNumber,
  overallConfidence: conf,
  stakeholders: z.array(stakeholder).default([]),
  financialMetrics: z.array(financial).default([]),
  risks: z.array(risk).default([]),
  nextActions: z.array(action).default([]),
  decisionLog: z.array(decision).default([]),
  strategyGoals: z.array(goal).default([]),
  okrs: z.array(okr).default([]),
  microBattles: z.array(microBattle).default([]),
  strategyInsights: z.array(strategyInsight).default([]),
});

export type TrackerInput = z.infer<typeof trackerSchema>;
