import { prisma } from "@/lib/db";
import { loadSkill } from "@/lib/skills";
import { generateJson } from "@/lib/gemini";
import { SKILL_REGISTRY } from "@/lib/skillRegistry";
import { skillAuthoringDraftSchema } from "@/lib/validation/skillPatch";

export type DraftSkillResult =
  | { ok: true; proposalId: string; autoApplied: boolean }
  | { ok: false; error: string };

// Triggered directly from the Skills Library's "describe a skill" editor
// (app/actions/skillAuthoring.ts), not from a downvote — this is the second
// entry point into the same review-gated proposal pipeline as lib/skillPatch.ts.
export async function draftSkillFromDescription(orgId: string, description: string, createdBy: string): Promise<DraftSkillResult> {
  const customSkills = await prisma.customSkill.findMany({ where: { orgId }, select: { name: true, title: true, description: true, category: true, content: true } });

  const catalog = [
    ...SKILL_REGISTRY.map((s) => `- name="${s.name}" title="${s.title}" category=${s.category} (built-in): ${s.description}`),
    ...customSkills.map((s) => `- name="${s.name}" title="${s.title}" category=${s.category} (org-authored): ${s.description}`),
  ].join("\n");

  const authoringSkill = loadSkill("skill-authoring");
  const prompt = `${authoringSkill}

## Existing skill catalog

${catalog || "(no skills registered yet)"}

## What was requested

${description}

## Required JSON output schema

{
  "action": "EXTEND" | "CREATE",
  "targetSkillName": string,
  "content": string,
  "title": string (required if CREATE),
  "description": string (required if CREATE),
  "category": "synthesis" | "framework" | "financial" | "question" (required if CREATE),
  "reasoning": string
}

If EXTEND, targetSkillName must be the EXACT name of an existing skill from the catalog above and content must be its full patched instructions. If CREATE, targetSkillName must be a new kebab-case slug that doesn't collide with any name in the catalog. Return ONLY the JSON object, no markdown fences, no other text.`;

  let raw: string;
  try {
    raw = await generateJson(prompt);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gemini call failed." };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Gemini did not return valid JSON." };
  }

  const result = skillAuthoringDraftSchema.safeParse(parsedJson);
  if (!result.success) {
    return { ok: false, error: "Gemini response failed validation — try rephrasing the description." };
  }
  const draft = result.data;

  const builtIn = SKILL_REGISTRY.find((s) => s.name === draft.targetSkillName);
  const custom = customSkills.find((s) => s.name === draft.targetSkillName);

  let currentContent = "";
  let targetIsCustom = false;
  let isNewSkill = draft.action === "CREATE";

  if (draft.action === "EXTEND") {
    if (builtIn) {
      currentContent = loadSkill(builtIn.name);
      targetIsCustom = false;
    } else if (custom) {
      currentContent = custom.content;
      targetIsCustom = true;
    } else {
      // Model claimed EXTEND but named something that doesn't exist —
      // safest fallback is to treat it as a new skill rather than fail outright.
      isNewSkill = true;
    }
  } else if (builtIn || custom) {
    // Model claimed CREATE but picked a name that collides — fail loudly
    // rather than silently overwrite an existing skill.
    return { ok: false, error: `"${draft.targetSkillName}" already exists — ask for an extension instead, or rephrase so a new name is chosen.` };
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { autoApproveSkillPatches: true } });
  const autoApprove = org?.autoApproveSkillPatches ?? false;
  const noOp = !isNewSkill && draft.content.trim() === currentContent.trim();

  const proposal = await prisma.skillPatchProposal.create({
    data: {
      orgId,
      skillName: draft.targetSkillName,
      currentContent,
      proposedContent: draft.content,
      reasoning: draft.reasoning,
      isNewSkill,
      targetIsCustom: isNewSkill ? true : targetIsCustom,
      newSkillTitle: isNewSkill ? (draft.title ?? draft.targetSkillName) : null,
      newSkillDescription: isNewSkill ? (draft.description ?? "") : null,
      newSkillCategory: isNewSkill ? (draft.category ?? "synthesis") : null,
      status: autoApprove && !noOp ? "AUTO_APPLIED" : "PENDING",
      reviewedBy: autoApprove && !noOp ? createdBy : null,
      reviewedAt: autoApprove && !noOp ? new Date() : null,
    },
  });

  if (autoApprove && !noOp) {
    const { applyApprovedPatch } = await import("@/lib/skillPatch");
    await applyApprovedPatch(proposal);
  }

  return { ok: true, proposalId: proposal.id, autoApplied: autoApprove && !noOp };
}
