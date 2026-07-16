import type { SkillName } from "@/lib/skills";

// Short, agent-facing metadata for every skill — kept separate from the full
// .md instructional content so (a) the admin Skills screen can list them
// cheaply, and (b) the agent's tool-selection prompt only needs these one-line
// descriptions, not the full skill text (that's loaded on demand only when a
// skill is actually applied via the apply_skill tool — see lib/agentTools.ts).

export type SkillCategory = "synthesis" | "framework" | "financial" | "question";

export interface SkillMeta {
  name: SkillName;
  title: string;
  description: string;
  category: SkillCategory;
}

export const SKILL_REGISTRY: SkillMeta[] = [
  {
    name: "tactic-insight-extraction",
    title: "Tactic Insight Extraction",
    description: "Reads raw ingestion events and proposes new execution/outcome insights for existing tactics only — never invents new tactics.",
    category: "synthesis",
  },
  {
    name: "tracker-synthesis",
    title: "Tracker Strategy-vs-Outcome Synthesis",
    description: "Rewrites a tracker's leadership-ready 'current understanding' as a short set of Strategy-vs-Outcome insight cards.",
    category: "synthesis",
  },
  {
    name: "detect-clarifications",
    title: "Detect Clarifications",
    description: "Flags genuine confusion — contradictions, undefined terms, unclear ownership, unclear concepts — rather than just missing data.",
    category: "synthesis",
  },
  {
    name: "draft-stakeholder-question",
    title: "Draft Stakeholder Question",
    description: "Phrases one concise, specific question per identified gap, addressed to the stakeholder who owns that area.",
    category: "question",
  },
  {
    name: "evaluate-stakeholder-answer",
    title: "Evaluate Stakeholder Answer",
    description: "Judges whether a reply was a substantive, useful answer or an effective non-answer — the input to the learning loop.",
    category: "question",
  },
  {
    name: "strategic-framework-swot",
    title: "SWOT Strategic Evaluation",
    description: "Strengths/Weaknesses/Opportunities/Threats grounded strictly in the tracker's recorded data — a structured positioning check.",
    category: "framework",
  },
  {
    name: "framework-7s-biopharm",
    title: "7S Alignment Framework (BioPharm)",
    description: "McKinsey 7S adapted for post-merger integration engagements — checks whether an acquired practice is actually fusing into the parent firm's operating model. Tailored to BioPharm & Media Integration specifically.",
    category: "framework",
  },
  {
    name: "alliance-health-pfizer-pave",
    title: "Alliance Health Framework (Pfizer PAVE)",
    description: "Strategic alignment, governance cadence, performance/financial health, relationship trust, AI risk & compliance, and flexibility — grounded in the actual PAVE contract terms. For ongoing partnership/alliance engagements, not integrations.",
    category: "framework",
  },
  {
    name: "jv-marketing-lifecycle-pfizer-pave",
    title: "4-Quadrant JV Marketing Lifecycle (Pfizer PAVE)",
    description: "Strategic alignment/IP, co-marketing GTM, operational funnel/attribution, and financial clearance — mapping Pfizer as Product Company and Indegene as Service Company, grounded in the actual PAVE contract mechanics (DRE, PDE, Gross Margin Share, baseline/true-up).",
    category: "framework",
  },
  {
    name: "okr-alignment-assessment",
    title: "OKR Alignment Assessment",
    description: "Checks whether actual execution genuinely ladders up to stated OKRs; flags OKRs with no aligned work and misallocated effort.",
    category: "framework",
  },
  {
    name: "rag-scoring-rubric",
    title: "RAG Scoring Rubric",
    description: "Assigns/justifies Red-Amber-Green against an explicit, repeatable rubric instead of a subjective call.",
    category: "framework",
  },
  {
    name: "ingestion-summary",
    title: "Ingestion Summary",
    description: "Produces a compact, faithful summary of one raw ingestion event, sized proportionally to its length — the manifest entry search_raw_events shows the orchestrator.",
    category: "synthesis",
  },
  {
    name: "whole-tracker-gap-detection",
    title: "Whole-Tracker Gap Detection",
    description: "Reads the entire tracker (strategy, execution, financials, stakeholders, risks, decisions) to find gaps the narrow rule-based checks can't see — misalignment, missing coverage, unexplained variance.",
    category: "synthesis",
  },
  {
    name: "tactic-update-insight",
    title: "Tactic Update → Insight Drafting",
    description: "Turns a pasted free-text update about one execution tactic into a draft execution/outcome insight and optional status suggestion.",
    category: "synthesis",
  },
  {
    name: "financial-variance-analysis",
    title: "Financial Variance Analysis",
    description: "Quantifies planned vs. actual vs. forecast variance, classifies materiality, and flags unexplained gaps.",
    category: "financial",
  },
  {
    name: "margin-and-synergy-analysis",
    title: "Margin & Synergy Analysis",
    description: "Assesses cost/revenue synergy realization and margin trajectory against target, with run-rate projection.",
    category: "financial",
  },
];

export const CATEGORY_LABEL: Record<SkillCategory, string> = {
  synthesis: "Synthesis",
  framework: "Business Framework",
  financial: "Financial Analysis",
  question: "Curiosity Loop",
};
