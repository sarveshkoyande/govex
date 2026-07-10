import { prisma } from "@/lib/db";
import { sendQuestion } from "@/lib/outbound";
import { updatePatternStats } from "@/lib/evaluation";

// Shared by both the manual "Approve & Send" action (app/actions/questions.ts,
// RBAC-checked, user-triggered) and the fully-autonomous auto-send path used
// right after a question is drafted (lib/questions.ts, lib/synthesis.ts).
// This function itself does NOT check RBAC — callers are responsible for that
// when the trigger is a user action; the auto-send path is system-triggered
// and has no separate human approval step by design (per user's explicit
// choice — see memory: auto-approve-and-send).
export async function deliverQuestion(questionId: string, actorLabel: string): Promise<{ delivered: boolean; status: string }> {
  const question = await prisma.openQuestion.findUnique({
    where: { id: questionId },
    include: { stakeholder: true, tracker: { select: { name: true, orgId: true } } },
  });
  if (!question) throw new Error(`OpenQuestion ${questionId} not found`);

  await prisma.openQuestion.update({
    where: { id: questionId },
    data: { status: "APPROVED", approvedBy: actorLabel, approvedAt: new Date() },
  });

  const result = await sendQuestion(question.tracker.orgId, {
    questionId,
    trackerId: question.trackerId,
    trackerName: question.tracker.name,
    questionText: question.questionText,
    stakeholderName: question.stakeholder?.name ?? null,
    stakeholderEmail: question.stakeholder?.email ?? null,
    questionPattern: question.questionPattern,
  });

  await prisma.openQuestion.update({
    where: { id: questionId },
    data: {
      status: "ASKED",
      askedAt: new Date(),
      deliveryStatus: result.status,
      deliveryError: result.status === "FAILED" ? result.error : null,
    },
  });
  await updatePatternStats(question.tracker.orgId, question.questionPattern);

  return { delivered: result.delivered, status: result.status };
}
