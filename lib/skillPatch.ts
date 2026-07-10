import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { loadSkill, type SkillName } from "@/lib/skills";
import { generateJson } from "@/lib/gemini";
import { skillPatchDraftSchema } from "@/lib/validation/skillPatch";
import type { SkillPatchProposal } from "@prisma/client";

const SKILLS_DIR = path.join(process.cwd(), "skills");

// Which skill file's instructions actually govern a given insight type.
const INSIGHT_TYPE_TO_SKILL: Record<string, SkillName> = {
  STRATEGY: "tracker-synthesis",
  TACTIC_EXECUTION: "tactic-insight-extraction",
  TACTIC_OUTCOME: "tactic-insight-extraction",
};

// Actually materializes an APPROVED (or auto-approved) proposal — the one
// place all three outcomes (patch a built-in file, patch a CustomSkill row,
// create a brand-new CustomSkill row) are handled, so app/actions/skillPatches.ts's
// manual approve and every auto-apply path stay in sync.
export async function applyApprovedPatch(proposal: SkillPatchProposal): Promise<void> {
  if (proposal.isNewSkill) {
    await prisma.customSkill.create({
      data: {
        orgId: proposal.orgId,
        name: proposal.skillName,
        title: proposal.newSkillTitle ?? proposal.skillName,
        description: proposal.newSkillDescription ?? "",
        category: proposal.newSkillCategory ?? "synthesis",
        content: proposal.proposedContent,
        createdBy: proposal.reviewedBy ?? "system:auto-approve",
      },
    });
    return;
  }
  if (proposal.targetIsCustom) {
    await prisma.customSkill.updateMany({
      where: { orgId: proposal.orgId, name: proposal.skillName },
      data: { content: proposal.proposedContent },
    });
    return;
  }
  fs.writeFileSync(path.join(SKILLS_DIR, `${proposal.skillName}.md`), proposal.proposedContent, "utf-8");
}

function buildPrompt(input: { skillContent: string; insightTitle: string; insightText: string; feedbackNote: string }): string {
  const drafterSkill = loadSkill("skill-patch-drafting");
  return `${drafterSkill}

## Downvoted insight

Title: ${input.insightTitle}
Text: ${input.insightText}

## Human's stated reason it's wrong or unhelpful

${input.feedbackNote}

## Current content of the responsible skill file

${input.skillContent}

## Required JSON output schema

{ "proposedContent": string, "reasoning": string }

If this complaint isn't really this skill's responsibility, return proposedContent identical to the current content above and explain why in reasoning instead of stretching the skill's scope. Return ONLY the JSON object, no markdown fences, no other text.`;
}

// Called once, automatically, when a StrategyInsight is downvoted with a
// reason (app/actions/insightFeedback.ts). Fire-and-forget from the caller,
// same pattern as evaluateAnswer/summarizeIngestionEvent — never blocks the
// vote itself, and a failure here just means no patch gets drafted, nothing
// breaks. Downvotes only ever target built-in skills (INSIGHT_TYPE_TO_SKILL
// maps to SkillName), so isNewSkill/targetIsCustom are always false here.
export async function draftSkillPatch(feedbackId: string): Promise<void> {
  const feedback = await prisma.insightFeedback.findUnique({ where: { id: feedbackId } });
  if (!feedback || feedback.vote !== "DOWN" || !feedback.note) return;

  const targetSkill = INSIGHT_TYPE_TO_SKILL[feedback.insightType];
  if (!targetSkill) return;

  let insightTitle: string;
  let insightText: string;
  if (feedback.insightType === "STRATEGY") {
    const insight = await prisma.strategyInsight.findUnique({ where: { id: feedback.insightId } });
    if (!insight) return;
    insightTitle = insight.title;
    insightText = insight.description ?? "";
  } else {
    const insight = await prisma.tacticInsight.findUnique({ where: { id: feedback.insightId } });
    if (!insight) return;
    insightTitle = `${feedback.insightType === "TACTIC_EXECUTION" ? "Execution" : "Outcome"} insight (${insight.signal})`;
    insightText = insight.text;
  }

  const currentContent = loadSkill(targetSkill);
  const prompt = buildPrompt({
    skillContent: currentContent,
    insightTitle,
    insightText,
    feedbackNote: feedback.note,
  });

  let raw: string;
  try {
    raw = await generateJson(prompt);
  } catch (err) {
    console.error("[draftSkillPatch] Gemini call failed for feedback", feedbackId, err instanceof Error ? err.message : err);
    return;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    console.error("[draftSkillPatch] non-JSON response for feedback", feedbackId);
    return;
  }

  const result = skillPatchDraftSchema.safeParse(parsedJson);
  if (!result.success) {
    console.error("[draftSkillPatch] schema validation failed for feedback", feedbackId);
    return;
  }

  const org = await prisma.organization.findUnique({ where: { id: feedback.orgId }, select: { autoApproveSkillPatches: true } });
  const autoApprove = org?.autoApproveSkillPatches ?? false;
  const noOp = result.data.proposedContent.trim() === currentContent.trim();

  const proposal = await prisma.skillPatchProposal.create({
    data: {
      orgId: feedback.orgId,
      skillName: targetSkill,
      currentContent,
      proposedContent: result.data.proposedContent,
      reasoning: result.data.reasoning,
      sourceFeedbackId: feedback.id,
      // A no-op patch (drafter decided this isn't the skill's job to fix)
      // is never auto-applied even if the org has auto-approve on — writing
      // identical content back is pointless, and the human should still see
      // the "this needs a different skill" recommendation.
      status: autoApprove && !noOp ? "AUTO_APPLIED" : "PENDING",
      reviewedBy: autoApprove && !noOp ? "system:auto-approve" : null,
      reviewedAt: autoApprove && !noOp ? new Date() : null,
    },
  });

  if (autoApprove && !noOp) {
    await applyApprovedPatch(proposal);
    console.log("[draftSkillPatch] auto-applied patch to", targetSkill, "from proposal", proposal.id);
  }
}
