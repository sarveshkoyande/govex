"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, canWrite } from "@/lib/rbac";
import { findPromotableEntityCandidates, type PromotableEntityCandidate } from "@/lib/entityExtraction";

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
// panel and clicking "Add as Stakeholder" on this exact candidate IS the
// human-confirmation step (same standard as confirming a chat proposal),
// so there's no separate propose/confirm round-trip needed here.
export async function promoteEntityCandidate(trackerId: string, term: string): Promise<ActionResult<{ stakeholderId: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot add stakeholders." };

  const tracker = await prisma.tracker.findFirst({ where: { id: trackerId, orgId: user.orgId }, select: { id: true } });
  if (!tracker) return { ok: false, error: "Tracker not found." };

  const stakeholder = await prisma.stakeholder.create({ data: { trackerId, name: term } });

  revalidatePath(`/trackers/${trackerId}`);
  return { ok: true, data: { stakeholderId: stakeholder.id } };
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
