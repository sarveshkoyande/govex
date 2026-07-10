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
