import crypto from "node:crypto";
import { after } from "next/server";
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

  // File path (Power Automate OneDrive/SharePoint flow) — extract text now,
  // before storing anything, so a bad/unsupported file fails the request
  // instead of silently creating an event with no usable content.
  let rawText = input.rawText ?? "";
  if (!input.rawText && input.fileName && input.fileBase64) {
    try {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const { extractText } = await import("@/lib/fileExtraction");
      rawText = (await extractText(input.fileName, buffer)).trim();
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "File extraction failed." };
    }
    if (!rawText) {
      return { ok: false, error: `No extractable text found in "${input.fileName}" (e.g. a scanned/image-only file).` };
    }
  }

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
      rawText,
      fileName: input.fileName ?? null,
      rawPayload: input.rawPayload !== undefined ? JSON.stringify(input.rawPayload) : null,
      ingestedVia,
    },
  });

  // Drive-sync ledger — only when the caller sent driveFileId (the compare
  // endpoint's contract) and this is a real tracker, not a domain-only
  // context doc. Files in a synced folder are treated as static once
  // placed — this is existence-only dedup, not change detection — so
  // driveModifiedAt is just bookkeeping (defaults to "now" if the caller
  // doesn't send it), never compared against on the read side.
  if (input.driveFileId && trackerId) {
    const modifiedAt = input.driveModifiedAt ? new Date(input.driveModifiedAt) : new Date();
    await prisma.driveSyncedFile.upsert({
      where: { trackerId_driveFileId: { trackerId, driveFileId: input.driveFileId } },
      update: { driveModifiedAt: modifiedAt, eventId: event.id },
      create: { orgId, trackerId, driveFileId: input.driveFileId, driveModifiedAt: modifiedAt, eventId: event.id },
    });
  }

  // Background summary for every event (not just answers) — this is what
  // search_raw_events shows the chat orchestrator as a manifest entry
  // instead of either the full text or a meaningless fixed truncation.
  // Fire-and-forget for the same reason as the Stage 4 evaluation below:
  // this may be a webhook response path, and summarization is a Gemini call
  // that shouldn't block it. Wrapped in after() (next/server) so it actually
  // finishes on serverless (Vercel) instead of being killed the instant the
  // response is sent — a plain un-awaited promise only reliably keeps
  // running on a persistent Node server, not a serverless function.
  after(() =>
    import("@/lib/ingestionSummary").then(({ summarizeIngestionEvent }) => summarizeIngestionEvent(event.id)).catch((err) => {
      console.error("[ingestEvent] background summarization failed for", event.id, err);
    }),
  );

  // Knowledge-graph dictionary-tier extraction (free, deterministic) — see
  // lib/entityExtraction.ts. Also fire-and-forget; a failure here never
  // affects ingestion itself.
  after(() =>
    import("@/lib/entityExtraction").then(({ extractDictionaryMentions }) =>
      extractDictionaryMentions(orgId, "RAW_EVENT", event.id, rawText, trackerId),
    ).catch((err) => {
      console.error("[ingestEvent] background entity extraction failed for", event.id, err);
    }),
  );

  // Unresolved-mention tier — the "wiki-link to a page that doesn't exist
  // yet" case (see lib/entityExtraction.ts). One extra Gemini call per event,
  // only when it belongs to a tracker (nothing to promote a new stakeholder
  // into otherwise). Also fire-and-forget, same reasoning as above. Chained
  // (not parallel) with auto-promotion — that step needs this one's mentions
  // to already be recorded before it aggregates them.
  if (trackerId) {
    after(() =>
      import("@/lib/entityExtraction").then(async ({ extractUnresolvedMentions, autoPromoteEntityCandidates }) => {
        await extractUnresolvedMentions(orgId, "RAW_EVENT", event.id, rawText, trackerId);
        await autoPromoteEntityCandidates(orgId, trackerId);
      }).catch((err) => {
        console.error("[ingestEvent] background unresolved-entity extraction/promotion failed for", event.id, err);
      }),
    );
  }

  // Conceptual cross-theme linking (the CONCEPTUAL tier — Gemini judging
  // "these two themes are thematically related despite sharing no literal
  // vocabulary," see lib/entityExtraction.ts rebuildConceptualMentions) only
  // has anything to compute off of when a CONTEXT_DOC lands — that's the
  // only source buildProfiles() reads. Re-running it compares every
  // context-doc'd theme in the org against every other, so this only fires
  // on the (comparatively rare) context-doc upload, not on ordinary meeting/
  // email ingestion. Org-wide, not tracker-scoped, since a new context doc
  // can surface a fresh connection to ANY other theme in the org.
  if (input.source === "CONTEXT_DOC") {
    after(() =>
      import("@/lib/entityExtraction").then(({ rebuildConceptualMentions }) => rebuildConceptualMentions(orgId)).catch((err) => {
        console.error("[ingestEvent] background conceptual-linking rebuild failed for org", orgId, err);
      }),
    );
  }

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
      // after() keeps it running past the response on serverless too.
      after(() =>
        import("@/lib/evaluation").then(({ evaluateAnswer }) => evaluateAnswer(question.id)).catch((err) => {
          console.error("[ingestEvent] background evaluation failed for", question.id, err);
        }),
      );
    }
  }

  return { ok: true, eventId: event.id };
}
