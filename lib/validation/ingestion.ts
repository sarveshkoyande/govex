import { z } from "zod";
import { INGESTION_SOURCE } from "@/lib/enums";

// Shape of a Power-Automate-style webhook payload. Deliberately flat and
// generic — Stage 1 stores this as-is, it does not interpret it.
// Exactly one of trackerId/domainId must be set — domainId-only is for a
// domain that doesn't have a Tracker yet (e.g. ingesting a context-doc brief
// before that theme's tracker is built).
export const ingestionPayloadSchema = z
  .object({
    trackerId: z.string().min(1).optional(),
    domainId: z.string().min(1).optional(),
    source: z.enum(INGESTION_SOURCE),
    sourceSystem: z.string().min(1, "sourceSystem required"), // "outlook", "teams", "manual-test", ...
    subject: z.string().optional(),
    fromAddress: z.string().optional(),
    participants: z.string().optional(),
    occurredAt: z.string().datetime().optional(), // ISO 8601; defaults to now if omitted
    rawText: z.string().min(1, "rawText required"),
    rawPayload: z.unknown().optional(), // arbitrary original payload, stored serialized
    // Stage 3 — optional. When set, this event is treated as a stakeholder's
    // reply to that OpenQuestion (must be ASKED and belong to the same tracker).
    answersQuestionId: z.string().optional(),
  })
  .refine((v) => !!v.trackerId || !!v.domainId, { message: "trackerId or domainId required" });

export type IngestionPayload = z.infer<typeof ingestionPayloadSchema>;
