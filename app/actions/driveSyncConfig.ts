"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, canManageOutboundWebhook } from "@/lib/rbac";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function saveDriveSyncConfig(input: { url: string; secret: string; active: boolean }): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canManageOutboundWebhook(user.role)) return { ok: false, error: "Only System Admins can configure the drive sync webhook." };
  if (input.active && !input.url.trim()) return { ok: false, error: "A URL is required to activate the webhook." };

  await prisma.driveSyncConfig.upsert({
    where: { orgId: user.orgId },
    update: { url: input.url.trim(), secret: input.secret.trim() || null, active: input.active, updatedBy: user.email ?? user.id },
    create: { orgId: user.orgId, url: input.url.trim(), secret: input.secret.trim() || null, active: input.active, updatedBy: user.email ?? user.id },
  });

  revalidatePath("/settings/drive-sync-webhook");
  return { ok: true, data: undefined };
}

// Separate from triggerDriveSync (lib/driveSync.ts) — that one requires a
// real trackerId (it looks the tracker up to read/advance its sync cursor).
// This is a raw connectivity test straight from the settings page, same
// shape as outboundWebhook.ts's sendTestPing, with a fake trackerId/since
// the receiving flow can just ignore.
export async function sendDriveSyncTestPing(): Promise<ActionResult<{ delivered: boolean; status: string; error?: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canManageOutboundWebhook(user.role)) return { ok: false, error: "Only System Admins can test the drive sync webhook." };

  const config = await prisma.driveSyncConfig.findUnique({ where: { orgId: user.orgId } });
  if (!config || !config.active || !config.url) {
    return { ok: true, data: { delivered: false, status: "NOT_CONFIGURED" } };
  }

  let status: string;
  let error: string | undefined;
  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(config.secret ? { Authorization: `Bearer ${config.secret}` } : {}) },
      body: JSON.stringify({ trackerId: "test-ping", since: null }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) { status = "FAILED"; error = `Webhook returned ${res.status}`; }
    else status = "SUCCESS";
  } catch (err) {
    status = "FAILED";
    error = err instanceof Error ? err.message : "Unknown network error.";
  }

  await prisma.driveSyncConfig.update({ where: { orgId: user.orgId }, data: { lastUsedAt: new Date(), lastStatus: status, lastError: error ?? null } });
  revalidatePath("/settings/drive-sync-webhook");
  return { ok: true, data: { delivered: status === "SUCCESS", status, error } };
}
