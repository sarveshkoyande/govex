"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser, canManageSkillPatches } from "@/lib/rbac";
import { draftSkillFromDescription } from "@/lib/skillAuthoring";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function draftSkill(description: string): Promise<ActionResult<{ autoApplied: boolean }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canManageSkillPatches(user.role)) return { ok: false, error: "Only System Admins can author skills." };
  if (!description.trim()) return { ok: false, error: "Describe what you want the skill to do." };

  const result = await draftSkillFromDescription(user.orgId, description.trim(), user.email ?? user.id);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/settings/skills");
  return { ok: true, data: { autoApplied: result.autoApplied } };
}
