import fs from "node:fs";
import path from "node:path";

// Lightweight skill-loader per PROJECT_PHILOSOPHY.md non-negotiable #4:
// "modular SKILL.md-style files ... loaded into context on demand by our own
// orchestration code rather than by a vendor feature." We only have Gemini
// API access (not Claude's native Skills feature), so this replicates the
// pattern manually: given a task, select the matching skill file(s) and
// inject their content into the prompt.

const SKILLS_DIR = path.join(process.cwd(), "skills");

export type SkillName =
  | "tactic-insight-extraction"
  | "tracker-synthesis"
  | "draft-stakeholder-question"
  | "evaluate-stakeholder-answer"
  | "detect-clarifications"
  | "strategic-framework-swot"
  | "framework-7s-biopharm"
  | "alliance-health-pfizer-pave"
  | "jv-marketing-lifecycle-pfizer-pave"
  | "okr-alignment-assessment"
  | "rag-scoring-rubric"
  | "financial-variance-analysis"
  | "margin-and-synergy-analysis"
  | "tactic-update-insight"
  | "whole-tracker-gap-detection"
  | "ingestion-summary"
  // Internal-only — drives lib/skillPatch.ts and lib/skillAuthoring.ts,
  // deliberately NOT registered in lib/skillRegistry.ts so neither ever
  // appears in the Skills Library UI or is selectable by apply_skill.
  | "skill-patch-drafting"
  | "skill-authoring"
  | "entity-conceptual-linking"
  | "unresolved-entity-classification"
  | "concept-page-compilation";

export function loadSkill(name: SkillName): string {
  const file = path.join(SKILLS_DIR, `${name}.md`);
  return fs.readFileSync(file, "utf-8");
}

export function loadSkills(names: SkillName[]): string {
  return names.map(loadSkill).join("\n\n---\n\n");
}
