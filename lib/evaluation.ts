import { prisma } from "@/lib/db";
import { loadSkills } from "@/lib/skills";
import { generateJson } from "@/lib/gemini";
import { answerEvaluationSchema } from "@/lib/validation/synthesis";
import { PATTERN_MIN_SAMPLES, PATTERN_DISABLE_THRESHOLD } from "@/lib/enums";

function buildPrompt(questionText: string, replyText: string): string {
  const skill = loadSkills(["evaluate-stakeholder-answer"]);
  return `You are the GovEx learning-loop evaluator. Apply the skill below, then return ONLY a single JSON object matching the schema at the end. Do not include markdown fences or any text outside the JSON object.

${skill}

## Question asked
${questionText}

## Reply received
${replyText}

## Required JSON output schema

{ "verdict": "USEFUL" | "NON_ANSWER", "reasoning": string }`;
}

// Called once, automatically, when a reply is captured (lib/ingestion.ts).
// Best-effort: a Gemini/parsing failure here must never break ingestion, so
// this function swallows its own errors after logging.
export async function evaluateAnswer(questionId: string): Promise<void> {
  const question = await prisma.openQuestion.findUnique({
    where: { id: questionId },
    include: { answerEvent: true, tracker: { select: { orgId: true } } },
  });
  if (!question?.answerEvent) return;

  try {
    const raw = await generateJson(buildPrompt(question.questionText, question.answerEvent.rawText));
    const parsed = answerEvaluationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      console.error("[evaluateAnswer] schema validation failed for", questionId);
      return;
    }

    await prisma.openQuestion.update({
      where: { id: questionId },
      data: { answerVerdict: parsed.data.verdict, answerVerdictReasoning: parsed.data.reasoning, evaluatedAt: new Date() },
    });

    await updatePatternStats(question.tracker.orgId, question.questionPattern);
  } catch (err) {
    console.error("[evaluateAnswer] failed for", questionId, err instanceof Error ? err.message : err);
  }
}

// Recomputes the (org, pattern) aggregate from ground truth (actual
// OpenQuestion rows) rather than incrementing counters — simpler to keep
// correct, and cheap enough given per-tracker question volumes.
export async function updatePatternStats(orgId: string, questionPattern: string): Promise<void> {
  const questions = await prisma.openQuestion.findMany({
    where: { tracker: { orgId }, questionPattern },
    select: { status: true, answerVerdict: true },
  });

  const askedCount = questions.filter((q) => ["ASKED", "ANSWERED"].includes(q.status)).length;
  const answeredCount = questions.filter((q) => q.status === "ANSWERED" && q.answerVerdict).length;
  const usefulCount = questions.filter((q) => q.answerVerdict === "USEFUL").length;
  const nonAnswerCount = questions.filter((q) => q.answerVerdict === "NON_ANSWER").length;

  const existing = await prisma.questionPatternStats.findUnique({ where: { orgId_questionPattern: { orgId, questionPattern } } });

  const usefulRate = answeredCount > 0 ? usefulCount / answeredCount : null;
  const shouldAutoDisable =
    existing?.enabled !== false && // don't re-trigger if already disabled
    answeredCount >= PATTERN_MIN_SAMPLES &&
    usefulRate !== null &&
    usefulRate < PATTERN_DISABLE_THRESHOLD;

  await prisma.questionPatternStats.upsert({
    where: { orgId_questionPattern: { orgId, questionPattern } },
    update: {
      askedCount,
      answeredCount,
      usefulCount,
      nonAnswerCount,
      ...(shouldAutoDisable
        ? { enabled: false, disabledAt: new Date(), disabledReason: `Auto-disabled: ${usefulCount}/${answeredCount} useful (${Math.round((usefulRate ?? 0) * 100)}%) over ${answeredCount} answers, below the ${Math.round(PATTERN_DISABLE_THRESHOLD * 100)}% threshold.` }
        : {}),
    },
    create: {
      orgId,
      questionPattern,
      askedCount,
      answeredCount,
      usefulCount,
      nonAnswerCount,
      enabled: !shouldAutoDisable,
      ...(shouldAutoDisable
        ? { disabledAt: new Date(), disabledReason: `Auto-disabled: ${usefulCount}/${answeredCount} useful (${Math.round((usefulRate ?? 0) * 100)}%) over ${answeredCount} answers, below the ${Math.round(PATTERN_DISABLE_THRESHOLD * 100)}% threshold.` }
        : {}),
    },
  });
}
