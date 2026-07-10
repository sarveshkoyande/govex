"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, canWrite } from "@/lib/rbac";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type VotableInsightType = "STRATEGY" | "TACTIC_EXECUTION" | "TACTIC_OUTCOME";

async function resolveTrackerId(insightType: VotableInsightType, insightId: string, orgId: string): Promise<string | null> {
  if (insightType === "STRATEGY") {
    const insight = await prisma.strategyInsight.findFirst({ where: { id: insightId, tracker: { orgId } }, select: { trackerId: true } });
    return insight?.trackerId ?? null;
  }
  // TACTIC_EXECUTION / TACTIC_OUTCOME both live on TacticInsight, reached via
  // its tactic's micro-battle's tracker.
  const insight = await prisma.tacticInsight.findFirst({
    where: { id: insightId, tactic: { microBattle: { tracker: { orgId } } } },
    select: { tactic: { select: { microBattle: { select: { trackerId: true } } } } },
  });
  return insight?.tactic.microBattle.trackerId ?? null;
}

export async function voteInsight(
  insightType: VotableInsightType,
  insightId: string,
  vote: "UP" | "DOWN",
  note?: string,
): Promise<ActionResult<{ patchDrafting: boolean }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot vote on insights." };
  if (vote === "DOWN" && !note?.trim()) return { ok: false, error: "A reason is required to downvote." };

  const trackerId = await resolveTrackerId(insightType, insightId, user.orgId);
  if (!trackerId) return { ok: false, error: "Insight not found." };

  const feedback = await prisma.insightFeedback.create({
    data: {
      orgId: user.orgId,
      insightType,
      insightId,
      vote,
      note: note?.trim() || null,
      createdBy: user.email ?? user.id,
    },
  });

  let patchDrafting = false;
  if (vote === "DOWN") {
    patchDrafting = true;
    // Fire-and-forget — drafting a patch is a Gemini call that shouldn't
    // block the vote itself from registering.
    import("@/lib/skillPatch").then(({ draftSkillPatch }) => draftSkillPatch(feedback.id)).catch((err) => {
      console.error("[voteInsight] background patch drafting failed for", feedback.id, err);
    });
  }

  revalidatePath(`/trackers/${trackerId}`);
  return { ok: true, data: { patchDrafting } };
}
