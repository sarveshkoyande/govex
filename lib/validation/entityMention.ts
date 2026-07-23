import { z } from "zod";

// Response shape for skills/entity-conceptual-linking.md.
export const conceptualLinkResponseSchema = z.object({
  connections: z
    .array(
      z.object({
        targetId: z.string().min(1),
        reasoning: z.string().min(1),
        confidence: z.number().int().min(0).max(100),
      }),
    )
    .default([]),
});
export type ConceptualLinkResponse = z.infer<typeof conceptualLinkResponseSchema>;

// Response shape for skills/unresolved-entity-classification.md.
export const unresolvedEntityClassificationSchema = z.object({
  candidates: z
    .array(
      z.object({
        term: z.string().min(1), // must echo one of the input candidates verbatim
        isEntity: z.boolean(),
        entityType: z.enum(["PERSON", "PROJECT", "ORGANIZATION", "OTHER"]),
        confidence: z.number().int().min(0).max(100),
      }),
    )
    .default([]),
});
export type UnresolvedEntityClassification = z.infer<typeof unresolvedEntityClassificationSchema>;
