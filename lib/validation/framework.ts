import { z } from "zod";

// Structured-output contract for "framework"-category skills (7S, SWOT,
// Alliance Health, JV Marketing Lifecycle, OKR alignment, RAG rubric, and any
// org-authored framework skill). Forcing this shape — rather than trusting
// free-text prose to "sound like" the framework was applied — is the actual
// guarantee that every element the framework defines was addressed
// individually, not paraphrased or skipped. See lib/agentTools.ts applySkillTool.
export const frameworkElementSchema = z.object({
  name: z.string().min(1), // e.g. "Strategy", "Weaknesses", "Governance Cadence"
  // The framework's OWN vocabulary for this element's verdict — kept verbatim
  // (e.g. "ALIGNED", "AT RISK", "Red", "Strength") so the human sees the real
  // framework language, not a normalized generic label.
  statusLabel: z.string().min(1),
  // Normalized bucket statusLabel maps to, purely for consistent rendering
  // (color/icon) across every framework regardless of its own vocabulary.
  statusTone: z.enum(["positive", "risk", "negative", "neutral"]),
  evidence: z.string().min(1),
});

export const frameworkOutputSchema = z.object({
  frameworkName: z.string().min(1),
  elements: z.array(frameworkElementSchema).min(1),
  soWhat: z.string().min(1),
});

export type FrameworkElement = z.infer<typeof frameworkElementSchema>;
export type FrameworkOutput = z.infer<typeof frameworkOutputSchema>;
