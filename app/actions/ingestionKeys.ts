"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, canManageIngestionKeys } from "@/lib/rbac";
import { generateIngestionToken, hashToken } from "@/lib/ingestion";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function createIngestionKey(
  label: string,
): Promise<ActionResult<{ rawToken: string; id: string; tokenPreview: string; createdAt: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canManageIngestionKeys(user.role)) return { ok: false, error: "Only System Admins can manage ingestion keys." };
  if (!label.trim()) return { ok: false, error: "Label is required." };

  const rawToken = generateIngestionToken();
  const created = await prisma.ingestionApiKey.create({
    data: {
      orgId: user.orgId,
      label: label.trim(),
      tokenHash: hashToken(rawToken),
      tokenPreview: rawToken.slice(-4),
      createdBy: user.email ?? user.id,
    },
  });

  revalidatePath("/settings/ingestion-keys");
  // Raw token is returned ONCE — it is never stored or retrievable again.
  return {
    ok: true,
    data: { rawToken, id: created.id, tokenPreview: created.tokenPreview, createdAt: created.createdAt.toISOString() },
  };
}

export async function revokeIngestionKey(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canManageIngestionKeys(user.role)) return { ok: false, error: "Only System Admins can manage ingestion keys." };

  const key = await prisma.ingestionApiKey.findFirst({ where: { id, orgId: user.orgId } });
  if (!key) return { ok: false, error: "Key not found." };

  await prisma.ingestionApiKey.update({ where: { id }, data: { revoked: true } });
  revalidatePath("/settings/ingestion-keys");
  return { ok: true, data: undefined };
}
