import { prisma } from "@/lib/db";

export type SendResult =
  | { delivered: true; status: "SENT" }
  | { delivered: false; status: "NOT_CONFIGURED" }
  | { delivered: false; status: "FAILED"; error: string };

// Sends an approved question to the org's configured Power Automate webhook.
// Mirrors Stage 1's inbound webhook, just in the opposite direction: GovEx is
// the caller here, Power Automate is expected to actually deliver the
// message (email/Teams) to the stakeholder. If no webhook is configured yet
// (no real M365 tenant wired up), this is a graceful, expected no-op — the
// question is still recorded as "asked" so the rest of the loop is testable.
export async function sendQuestion(
  orgId: string,
  payload: {
    questionId: string;
    trackerId: string;
    trackerName: string;
    questionText: string;
    stakeholderName: string | null;
    stakeholderEmail: string | null;
    questionPattern: string;
  },
): Promise<SendResult> {
  const config = await prisma.outboundWebhookConfig.findUnique({ where: { orgId } });
  if (!config || !config.active || !config.url) {
    return { delivered: false, status: "NOT_CONFIGURED" };
  }

  // The Power Automate flow's HTTP trigger schema is fixed to exactly
  // { ticketId, question, recipient } — these three are what the adaptive
  // card flow reads (recipient -> Get user profile, question -> card body,
  // ticketId -> round-tripped in the card's Action.Submit data so
  // /api/questions/answer can match the reply back to this OpenQuestion).
  // The rest of the original payload is included too since Power Automate's
  // HTTP trigger doesn't reject unknown properties, so nothing else changes.
  const body = {
    ticketId: payload.questionId,
    question: payload.questionText,
    recipient: payload.stakeholderEmail,
    ...payload,
  };

  try {
    const res = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.secret ? { Authorization: `Bearer ${config.secret}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const error = `Webhook returned ${res.status}`;
      await prisma.outboundWebhookConfig.update({ where: { orgId }, data: { lastUsedAt: new Date(), lastStatus: "FAILED", lastError: error } });
      return { delivered: false, status: "FAILED", error };
    }

    await prisma.outboundWebhookConfig.update({ where: { orgId }, data: { lastUsedAt: new Date(), lastStatus: "SUCCESS", lastError: null } });
    return { delivered: true, status: "SENT" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown network error.";
    await prisma.outboundWebhookConfig.update({ where: { orgId }, data: { lastUsedAt: new Date(), lastStatus: "FAILED", lastError: error } });
    return { delivered: false, status: "FAILED", error };
  }
}
