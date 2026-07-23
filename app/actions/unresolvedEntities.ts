"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, canWrite } from "@/lib/rbac";
import { findPromotableEntityCandidates, promoteCandidate, type PromotableEntityCandidate } from "@/lib/entityExtraction";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function getUnresolvedEntityCandidates(trackerId: string): Promise<ActionResult<PromotableEntityCandidate[]>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const tracker = await prisma.tracker.findFirst({ where: { id: trackerId, orgId: user.orgId }, select: { id: true } });
  if (!tracker) return { ok: false, error: "Tracker not found." };

  const candidates = await findPromotableEntityCandidates(user.orgId, trackerId);
  return { ok: true, data: candidates };
}

// Direct action, not a staged proposal — the admin reviewing this exact
// panel and clicking "promote" on this exact candidate IS the
// human-confirmation step (same standard as confirming a chat proposal),
// so there's no separate propose/confirm round-trip needed here. Mirrors
// autoPromoteEntityCandidates' per-type mapping (lib/entityExtraction.ts) —
// this is the same promotion, just human-triggered instead of automatic.
export async function promoteEntityCandidate(
  trackerId: string,
  term: string,
  entityType: "PERSON" | "PROJECT" | "ORGANIZATION" | "OTHER",
): Promise<ActionResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot promote candidates." };

  const tracker = await prisma.tracker.findFirst({ where: { id: trackerId, orgId: user.orgId }, select: { id: true } });
  if (!tracker) return { ok: false, error: "Tracker not found." };

  const result = await promoteCandidate(user.orgId, trackerId, term, entityType);
  revalidatePath(`/trackers/${trackerId}`);
  return { ok: true, data: { id: result.id } };
}

export async function dismissEntityCandidate(trackerId: string, term: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot dismiss candidates." };

  const tracker = await prisma.tracker.findFirst({ where: { id: trackerId, orgId: user.orgId }, select: { id: true } });
  if (!tracker) return { ok: false, error: "Tracker not found." };

  await prisma.dismissedEntityCandidate.upsert({
    where: { trackerId_term: { trackerId, term: term.toLowerCase() } },
    update: {},
    create: { orgId: user.orgId, trackerId, term: term.toLowerCase() },
  });

  revalidatePath(`/trackers/${trackerId}`);
  return { ok: true, data: undefined };
}
