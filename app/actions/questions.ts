"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSessionUser, canWrite } from "@/lib/rbac";
import { draftQuestions } from "@/lib/questions";
import { sendQuestion } from "@/lib/outbound";
import { deliverQuestion } from "@/lib/questionDelivery";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function generateQuestions(trackerId: string): Promise<ActionResult<{ questionCount: number }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot draft questions." };

  const result = await draftQuestions(trackerId, user.orgId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/trackers/${trackerId}`);
  return { ok: true, data: { questionCount: result.questionCount } };
}

export async function approveAndSendQuestion(id: string, edits?: { questionText?: string }): Promise<ActionResult<{ delivered: boolean; status: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot approve questions." };

  const question = await prisma.openQuestion.findFirst({ where: { id, tracker: { orgId: user.orgId } } });
  if (!question) return { ok: false, error: "Question not found." };
  if (question.status !== "DRAFT") return { ok: false, error: `Question already ${question.status.toLowerCase()}.` };

  // Kept for any DRAFT question a human wants to review/edit before sending
  // (e.g. one that failed auto-send earlier, or a manually-created one) —
  // the normal auto-generated path (lib/questions.ts, lib/synthesis.ts) skips
  // this and calls deliverQuestion directly per the fully-autonomous choice.
  if (edits?.questionText) {
    await prisma.openQuestion.update({ where: { id }, data: { questionText: edits.questionText } });
  }

  const result = await deliverQuestion(id, user.email ?? user.id);

  revalidatePath(`/trackers/${question.trackerId}`);
  return { ok: true, data: { delivered: result.delivered, status: result.status } };
}

export async function retrySendQuestion(id: string): Promise<ActionResult<{ delivered: boolean; status: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot resend questions." };

  const question = await prisma.openQuestion.findFirst({
    where: { id, tracker: { orgId: user.orgId } },
    include: { stakeholder: true, tracker: { select: { name: true } } },
  });
  if (!question) return { ok: false, error: "Question not found." };
  if (question.status !== "ASKED") return { ok: false, error: "Only asked (undelivered) questions can be resent." };

  const result = await sendQuestion(user.orgId, {
    questionId: id,
    trackerId: question.trackerId,
    trackerName: question.tracker.name,
    questionText: question.questionText,
    stakeholderName: question.stakeholder?.name ?? null,
    stakeholderEmail: question.stakeholder?.email ?? null,
    questionPattern: question.questionPattern,
  });

  await prisma.openQuestion.update({
    where: { id },
    data: { deliveryStatus: result.status, deliveryError: result.status === "FAILED" ? result.error : null },
  });

  revalidatePath(`/trackers/${question.trackerId}`);
  return { ok: true, data: { delivered: result.delivered, status: result.status } };
}

export async function reassignQuestion(id: string, stakeholderId: string | null): Promise<ActionResult<{ delivered: boolean; status: string }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot reassign questions." };

  const question = await prisma.openQuestion.findFirst({ where: { id, tracker: { orgId: user.orgId } } });
  if (!question) return { ok: false, error: "Question not found." };

  if (stakeholderId) {
    const stakeholder = await prisma.stakeholder.findFirst({ where: { id: stakeholderId, trackerId: question.trackerId } });
    if (!stakeholder) return { ok: false, error: "That stakeholder doesn't belong to this tracker." };
  }

  await prisma.openQuestion.update({ where: { id }, data: { stakeholderId } });

  // If it was already sent, re-send to the newly assigned person so they
  // actually receive it — reassigning silently without resending would leave
  // the original (wrong) recipient as the only one who ever saw it.
  let result = { delivered: false, status: "NOT_SENT_YET" };
  if (question.status === "ASKED" || question.status === "APPROVED") {
    result = await deliverQuestion(id, user.email ?? user.id);
  }

  revalidatePath(`/trackers/${question.trackerId}`);
  return { ok: true, data: result };
}

export async function reenablePattern(questionPattern: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.role !== "SYSTEM_ADMIN") return { ok: false, error: "Only System Admins can re-enable a question pattern." };

  const stats = await prisma.questionPatternStats.findUnique({ where: { orgId_questionPattern: { orgId: user.orgId, questionPattern } } });
  if (!stats) return { ok: false, error: "No stats found for that pattern." };

  await prisma.questionPatternStats.update({
    where: { id: stats.id },
    data: { enabled: true, reenabledBy: user.email ?? user.id, reenabledAt: new Date() },
  });

  revalidatePath("/settings/question-patterns");
  return { ok: true, data: undefined };
}

export async function dismissQuestion(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot dismiss questions." };

  const question = await prisma.openQuestion.findFirst({ where: { id, tracker: { orgId: user.orgId } } });
  if (!question) return { ok: false, error: "Question not found." };

  await prisma.openQuestion.update({ where: { id }, data: { status: "DISMISSED" } });
  revalidatePath(`/trackers/${question.trackerId}`);
  return { ok: true, data: undefined };
}
