"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, canManageOutboundWebhook } from "@/lib/rbac";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function saveOutboundWebhook(input: { url: string; secret: string; active: boolean }): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canManageOutboundWebhook(user.role)) return { ok: false, error: "Only System Admins can configure the outbound webhook." };
  if (input.active && !input.url.trim()) return { ok: false, error: "A URL is required to activate the webhook." };

  await prisma.outboundWebhookConfig.upsert({
    where: { orgId: user.orgId },
    update: { url: input.url.trim(), secret: input.secret.trim() || null, active: input.active, updatedBy: user.email ?? user.id },
    create: { orgId: user.orgId, url: input.url.trim(), secret: input.secret.trim() || null, active: input.active, updatedBy: user.email ?? user.id },
  });

  revalidatePath("/settings/outbound-webhook");
  return { ok: true, data: undefined };
}

export async function sendTestPing(): Promise<ActionResult<{ delivered: boolean; status: string; error?: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canManageOutboundWebhook(user.role)) return { ok: false, error: "Only System Admins can test the outbound webhook." };

  const { sendQuestion } = await import("@/lib/outbound");
  const result = await sendQuestion(user.orgId, {
    questionId: "test-ping",
    trackerId: "test-ping",
    trackerName: "GovEx Test",
    questionText: "This is a test ping from GovEx's Outbound Webhook settings page.",
    stakeholderName: "Test Stakeholder",
    stakeholderEmail: "test@example.com",
    questionPattern: "TEST_PING",
  });

  revalidatePath("/settings/outbound-webhook");
  return { ok: true, data: { delivered: result.delivered, status: result.status, error: result.status === "FAILED" ? result.error : undefined } };
}
