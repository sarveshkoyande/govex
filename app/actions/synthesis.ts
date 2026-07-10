"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, canWrite } from "@/lib/rbac";
import { runSynthesis } from "@/lib/synthesis";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function generateInsights(trackerId: string): Promise<ActionResult<{ suggestionCount: number; clarificationCount: number }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot generate AI insights." };

  const result = await runSynthesis(trackerId, user.orgId, user.email ?? user.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/trackers/${trackerId}`);
  revalidatePath(`/trackers/${trackerId}/review`);
  return { ok: true, data: { suggestionCount: result.suggestionCount, clarificationCount: result.clarificationCount } };
}

interface Edits {
  text?: string;
  title?: string;
  signal?: string;
  confidence?: number;
}

export async function approveSuggestion(id: string, edits?: Edits): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot approve AI suggestions." };

  const suggestion = await prisma.aiSuggestion.findFirst({ where: { id, tracker: { orgId: user.orgId } } });
  if (!suggestion) return { ok: false, error: "Suggestion not found." };
  if (suggestion.status !== "PENDING") return { ok: false, error: `Suggestion already ${suggestion.status.toLowerCase()}.` };

  const text = edits?.text ?? suggestion.text;
  const signal = edits?.signal ?? suggestion.signal;
  const confidence = edits?.confidence ?? suggestion.confidence;

  let materializedId: string;

  if (suggestion.kind === "STRATEGY_INSIGHT") {
    const created = await prisma.strategyInsight.create({
      data: {
        trackerId: suggestion.trackerId,
        title: edits?.title ?? suggestion.title ?? "Untitled insight",
        description: text,
        source: "GEMINI",
        confidence,
        order: 999, // appended after manual cards; reorder via edit form if needed
      },
    });
    materializedId = created.id;
  } else {
    if (!suggestion.targetTacticId) return { ok: false, error: "Suggestion is missing its target tactic." };
    const created = await prisma.tacticInsight.create({
      data: {
        tacticId: suggestion.targetTacticId,
        kind: suggestion.kind === "TACTIC_EXECUTION" ? "EXECUTION" : "OUTCOME",
        signal,
        text,
        source: "GEMINI",
        confidence,
      },
    });
    materializedId = created.id;
  }

  await prisma.aiSuggestion.update({
    where: { id },
    data: { status: "APPROVED", reviewedBy: user.email ?? user.id, reviewedAt: new Date(), materializedId },
  });

  revalidatePath(`/trackers/${suggestion.trackerId}`);
  revalidatePath(`/trackers/${suggestion.trackerId}/review`);
  return { ok: true, data: undefined };
}

export async function rejectSuggestion(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot reject AI suggestions." };

  const suggestion = await prisma.aiSuggestion.findFirst({ where: { id, tracker: { orgId: user.orgId } } });
  if (!suggestion) return { ok: false, error: "Suggestion not found." };
  if (suggestion.status !== "PENDING") return { ok: false, error: `Suggestion already ${suggestion.status.toLowerCase()}.` };

  await prisma.aiSuggestion.update({
    where: { id },
    data: { status: "REJECTED", reviewedBy: user.email ?? user.id, reviewedAt: new Date() },
  });

  revalidatePath(`/trackers/${suggestion.trackerId}`);
  revalidatePath(`/trackers/${suggestion.trackerId}/review`);
  return { ok: true, data: undefined };
}
