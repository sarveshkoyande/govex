"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, canManageOutboundWebhook } from "@/lib/rbac";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function setAutoPromoteEntities(enabled: boolean): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canManageOutboundWebhook(user.role)) return { ok: false, error: "Only System Admins can change this setting." };

  await prisma.organization.update({ where: { id: user.orgId }, data: { autoPromoteEntities: enabled } });
  revalidatePath("/settings/entity-promotion");
  return { ok: true, data: undefined };
}
