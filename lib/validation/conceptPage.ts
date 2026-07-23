import { z } from "zod";

// Response shape for skills/concept-page-compilation.md. The compile step
// (lib/conceptPage.ts) validates Gemini's output against this before writing
// the ConceptPage row — same discipline as every other AI-produced write in
// the app (a malformed response degrades to "keep the old page", never writes
// garbage).
export const conceptPageCompilationSchema = z.object({
  narrative: z.string().min(1),
  contradictions: z
    .array(
      z.object({
        claim: z.string().min(1),
        conflictingSources: z.string().min(1),
        note: z.string().default(""),
      }),
    )
    .default([]),
  mentionCount: z.number().int().min(0).default(0),
});
export type ConceptPageCompilation = z.infer<typeof conceptPageCompilationSchema>;
