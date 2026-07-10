"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, canManageSkillPatches } from "@/lib/rbac";
import { applyApprovedPatch } from "@/lib/skillPatch";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function approveSkillPatch(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canManageSkillPatches(user.role)) return { ok: false, error: "Only System Admins can approve skill patches." };

  const proposal = await prisma.skillPatchProposal.findFirst({ where: { id, orgId: user.orgId } });
  if (!proposal) return { ok: false, error: "Proposal not found." };
  if (proposal.status !== "PENDING") return { ok: false, error: `Proposal already ${proposal.status.toLowerCase()}.` };

  const reviewedBy = user.email ?? user.id;
  await applyApprovedPatch({ ...proposal, reviewedBy });

  await prisma.skillPatchProposal.update({
    where: { id },
    data: { status: "APPROVED", reviewedBy, reviewedAt: new Date() },
  });

  revalidatePath("/settings/skills");
  return { ok: true, data: undefined };
}

export async function rejectSkillPatch(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canManageSkillPatches(user.role)) return { ok: false, error: "Only System Admins can reject skill patches." };

  const proposal = await prisma.skillPatchProposal.findFirst({ where: { id, orgId: user.orgId } });
  if (!proposal) return { ok: false, error: "Proposal not found." };
  if (proposal.status !== "PENDING") return { ok: false, error: `Proposal already ${proposal.status.toLowerCase()}.` };

  await prisma.skillPatchProposal.update({
    where: { id },
    data: { status: "REJECTED", reviewedBy: user.email ?? user.id, reviewedAt: new Date() },
  });

  revalidatePath("/settings/skills");
  return { ok: true, data: undefined };
}

export async function setAutoApproveSkillPatches(enabled: boolean): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canManageSkillPatches(user.role)) return { ok: false, error: "Only System Admins can change this setting." };

  await prisma.organization.update({ where: { id: user.orgId }, data: { autoApproveSkillPatches: enabled } });
  revalidatePath("/settings/skills");
  return { ok: true, data: undefined };
}
