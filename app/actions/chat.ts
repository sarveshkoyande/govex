"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, canWrite } from "@/lib/rbac";
import { runAgentTurn } from "@/lib/agent";
import { deliverQuestion } from "@/lib/questionDelivery";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export interface ChatMessageView {
  id: string;
  role: string;
  content: string | null;
  toolName: string | null;
  toolResult: string | null;
  proposalKind: string | null;
  proposalPayload: string | null;
  proposalStatus: string | null;
  proposalTrackerId: string | null;
  createdAt: string;
}

export async function getOrCreateActiveSession(): Promise<ActionResult<{ sessionId: string; messages: ChatMessageView[] }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  let session = await prisma.chatSession.findFirst({
    where: { orgId: user.orgId, userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  if (!session) {
    session = await prisma.chatSession.create({ data: { orgId: user.orgId, userId: user.id, title: "New chat" } });
  }

  const messages = await prisma.chatMessage.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" } });
  return {
    ok: true,
    data: {
      sessionId: session.id,
      messages: messages.map(toView),
    },
  };
}

export async function startNewSession(): Promise<ActionResult<{ sessionId: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const session = await prisma.chatSession.create({ data: { orgId: user.orgId, userId: user.id, title: "New chat" } });
  return { ok: true, data: { sessionId: session.id } };
}

export async function sendChatMessage(sessionId: string, message: string): Promise<ActionResult<{ messages: ChatMessageView[] }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!message.trim()) return { ok: false, error: "Message is empty." };

  const session = await prisma.chatSession.findFirst({ where: { id: sessionId, orgId: user.orgId, userId: user.id } });
  if (!session) return { ok: false, error: "Chat session not found." };

  try {
    await runAgentTurn(sessionId, user.orgId, message.trim());
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Agent turn failed.";
    await prisma.chatMessage.create({ data: { sessionId, role: "assistant", content: `Sorry — something went wrong: ${errMsg}` } });
  }

  // Auto-title from the first user message.
  if (session.title === "New chat") {
    await prisma.chatSession.update({ where: { id: sessionId }, data: { title: message.trim().slice(0, 60) } });
  }

  const messages = await prisma.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: "asc" } });
  return { ok: true, data: { messages: messages.map(toView) } };
}

export async function confirmProposal(messageId: string): Promise<ActionResult<{ resultSummary: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot confirm this action." };

  const msg = await prisma.chatMessage.findFirst({
    where: { id: messageId, session: { orgId: user.orgId } },
  });
  if (!msg || !msg.proposalKind || msg.proposalStatus !== "PENDING") {
    return { ok: false, error: "No pending proposal found." };
  }
  if (!msg.proposalTrackerId) return { ok: false, error: "Proposal is missing its tracker." };

  const payload = JSON.parse(msg.proposalPayload ?? "{}");
  let resultSummary: string;

  if (msg.proposalKind === "CREATE_ACTION") {
    await prisma.nextAction.create({
      data: {
        trackerId: msg.proposalTrackerId,
        title: payload.title,
        owner: payload.owner || null,
        priority: payload.priority || "medium",
        dueDate: payload.dueDate || null,
        source: "GEMINI",
      },
    });
    resultSummary = `Created action "${payload.title}".`;
  } else if (msg.proposalKind === "DRAFT_QUESTION") {
    const created = await prisma.openQuestion.create({
      data: {
        trackerId: msg.proposalTrackerId,
        stakeholderId: payload.stakeholderId || null,
        questionPattern: "MANUAL",
        targetSummary: "Drafted from chat",
        questionText: payload.questionText,
        source: "MANUAL",
      },
    });
    const sendResult = await deliverQuestion(created.id, user.email ?? user.id);
    resultSummary = sendResult.status === "SENT" ? "Question sent." : `Question created (delivery: ${sendResult.status}).`;
  } else if (msg.proposalKind === "CREATE_STAKEHOLDER") {
    await prisma.stakeholder.create({
      data: {
        trackerId: msg.proposalTrackerId,
        name: payload.name,
        roleOnTracker: payload.roleOnTracker || null,
        ownsWhat: payload.ownsWhat || null,
      },
    });
    resultSummary = `Added "${payload.name}" as a stakeholder.`;
  } else {
    return { ok: false, error: `Unknown proposal kind "${msg.proposalKind}".` };
  }

  await prisma.chatMessage.update({ where: { id: messageId }, data: { proposalStatus: "CONFIRMED" } });
  revalidatePath(`/trackers/${msg.proposalTrackerId}`);
  return { ok: true, data: { resultSummary } };
}

export async function rejectProposal(messageId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot reject this action." };

  const msg = await prisma.chatMessage.findFirst({ where: { id: messageId, session: { orgId: user.orgId } } });
  if (!msg || msg.proposalStatus !== "PENDING") return { ok: false, error: "No pending proposal found." };

  // Rejecting a proposed stakeholder means "don't suggest this name again" —
  // record it so findPromotableEntityCandidates (lib/entityExtraction.ts)
  // stops resurfacing it every time it's mentioned again.
  if (msg.proposalKind === "CREATE_STAKEHOLDER" && msg.proposalTrackerId) {
    const payload = JSON.parse(msg.proposalPayload ?? "{}");
    const term = String(payload.name ?? "").toLowerCase().trim();
    if (term) {
      await prisma.dismissedEntityCandidate.upsert({
        where: { trackerId_term: { trackerId: msg.proposalTrackerId, term } },
        update: {},
        create: { orgId: user.orgId, trackerId: msg.proposalTrackerId, term },
      });
    }
  }

  await prisma.chatMessage.update({ where: { id: messageId }, data: { proposalStatus: "REJECTED" } });
  return { ok: true, data: undefined };
}

function toView(m: {
  id: string; role: string; content: string | null; toolName: string | null; toolResult: string | null;
  proposalKind: string | null; proposalPayload: string | null; proposalStatus: string | null;
  proposalTrackerId: string | null; createdAt: Date;
}): ChatMessageView {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    toolName: m.toolName,
    toolResult: m.toolResult,
    proposalKind: m.proposalKind,
    proposalPayload: m.proposalPayload,
    proposalStatus: m.proposalStatus,
    proposalTrackerId: m.proposalTrackerId,
    createdAt: m.createdAt.toISOString(),
  };
}
