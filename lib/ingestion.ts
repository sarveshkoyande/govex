import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { ingestionPayloadSchema, type IngestionPayload } from "@/lib/validation/ingestion";

// ===========================================================================
// Stage 1 ingestion core. This is the ONE place both the public webhook
// (app/api/ingest/route.ts) and the in-app manual test injector call into,
// so both paths exercise identical validation/storage logic.
//
// No synthesis happens here — this only validates shape, checks the tracker
// belongs to the resolved org, and stores the payload verbatim. Deriving
// execution/outcome insights from these events is Stage 2.
// ===========================================================================

const TOKEN_PREFIX = "govex_ingest_";

export function generateIngestionToken(): string {
  return TOKEN_PREFIX + crypto.randomBytes(24).toString("hex");
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export interface ResolvedApiKey {
  keyId: string;
  orgId: string;
}

// Looks up an org by bearer token. Returns null if missing/revoked.
export async function verifyIngestionToken(rawToken: string): Promise<ResolvedApiKey | null> {
  const tokenHash = hashToken(rawToken);
  const key = await prisma.ingestionApiKey.findUnique({ where: { tokenHash } });
  if (!key || key.revoked) return null;
  await prisma.ingestionApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return { keyId: key.id, orgId: key.orgId };
}

export type IngestResult =
  | { ok: true; eventId: string }
  | { ok: false; error: string };

export async function ingestEvent(
  orgId: string,
  apiKeyId: string | null,
  ingestedVia: "webhook" | "manual_test" | "system_import",
  raw: unknown,
): Promise<IngestResult> {
  const parsed = ingestionPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { ok: false, error: `${first.path.join(".")}: ${first.message}` };
  }
  const input: IngestionPayload = parsed.data;

  let trackerId: string | null = null;
  let domainId: string | null = null;
  if (input.trackerId) {
    const tracker = await prisma.tracker.findFirst({ where: { id: input.trackerId, orgId } });
    if (!tracker) return { ok: false, error: "trackerId does not belong to this organization." };
    trackerId = tracker.id;
  } else if (input.domainId) {
    const domain = await prisma.domain.findFirst({ where: { id: input.domainId, orgId } });
    if (!domain) return { ok: false, error: "domainId does not belong to this organization." };
    domainId = domain.id;
  }

  const event = await prisma.rawIngestionEvent.create({
    data: {
      trackerId,
      domainId,
      apiKeyId,
      source: input.source,
      sourceSystem: input.sourceSystem,
      subject: input.subject || null,
      fromAddress: input.fromAddress || null,
      participants: input.participants || null,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      rawText: input.rawText,
      rawPayload: input.rawPayload !== undefined ? JSON.stringify(input.rawPayload) : null,
      ingestedVia,
    },
  });

  // Background summary for every event (not just answers) — this is what
  // search_raw_events shows the chat orchestrator as a manifest entry
  // instead of either the full text or a meaningless fixed truncation.
  // Fire-and-forget for the same reason as the Stage 4 evaluation below:
  // this may be a webhook response path, and summarization is a Gemini call
  // that shouldn't block it.
  import("@/lib/ingestionSummary").then(({ summarizeIngestionEvent }) => summarizeIngestionEvent(event.id)).catch((err) => {
    console.error("[ingestEvent] background summarization failed for", event.id, err);
  });

  // Knowledge-graph dictionary-tier extraction (free, deterministic) — see
  // lib/entityExtraction.ts. Also fire-and-forget; a failure here never
  // affects ingestion itself.
  import("@/lib/entityExtraction").then(({ extractDictionaryMentions }) =>
    extractDictionaryMentions(orgId, "RAW_EVENT", event.id, input.rawText, trackerId),
  ).catch((err) => {
    console.error("[ingestEvent] background entity extraction failed for", event.id, err);
  });

  // Stage 3 — if this event is tagged as answering an open question, close
  // the loop. Lenient on failure: an invalid/stale tag never fails ingestion,
  // it just doesn't link (the event is still stored either way).
  if (input.answersQuestionId && trackerId) {
    const question = await prisma.openQuestion.findFirst({
      where: { id: input.answersQuestionId, trackerId, status: "ASKED" },
    });
    if (question) {
      await prisma.openQuestion.update({
        where: { id: question.id },
        data: { status: "ANSWERED", answeredAt: new Date(), answerEventId: event.id },
      });
      // Stage 4 — score the answer in the background. Deliberately not
      // awaited: this is a webhook response path (Power Automate is
      // waiting), and evaluation is a Gemini call that shouldn't block it.
      // Safe to fire-and-forget on our persistent Node server.
      import("@/lib/evaluation").then(({ evaluateAnswer }) => evaluateAnswer(question.id)).catch((err) => {
        console.error("[ingestEvent] background evaluation failed for", question.id, err);
      });
    }
  }

  return { ok: true, eventId: event.id };
}
