import { z } from "zod";

// Response shape for skills/skill-patch-drafting.md. If the diagnosed gap
// isn't really this skill's job, the drafter returns proposedContent
// unchanged (equal to currentContent) and explains why in reasoning — the
// human reviewer reads that and decides whether a new skill is warranted
// instead, rather than the drafter silently stretching this skill's scope.
export const skillPatchDraftSchema = z.object({
  proposedContent: z.string().min(1),
  reasoning: z.string().min(1),
});
export type SkillPatchDraft = z.infer<typeof skillPatchDraftSchema>;

// Response shape for skills/skill-authoring.md — the editor decides EXTEND
// vs. CREATE itself; title/description/category only matter for CREATE
// (an EXTEND keeps the target's existing metadata, only its content changes).
export const skillAuthoringDraftSchema = z.object({
  action: z.enum(["EXTEND", "CREATE"]),
  targetSkillName: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "must be a kebab-case slug"),
  content: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  category: z.enum(["synthesis", "framework", "financial", "question"]).optional(),
  reasoning: z.string().min(1),
});
export type SkillAuthoringDraft = z.infer<typeof skillAuthoringDraftSchema>;
