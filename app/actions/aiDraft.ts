"use server";

import { getSessionUser, canWrite } from "@/lib/rbac";
import { loadSkill, loadSkills } from "@/lib/skills";
import { generateJson } from "@/lib/gemini";
import { tacticUpdateInsightSchema, strategyVsOutcomeDraftSchema } from "@/lib/validation/aiDraft";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// Drafts one execution/outcome insight (+ optional status suggestion) for a
// single tactic from a pasted free-text update. Nothing is saved — the
// caller only gets a draft object back to slot into the client-side form
// state, same as every other AI-assisted write in this app (chat proposals,
// synthesis suggestions): staged, never auto-applied.
export async function draftTacticInsightFromUpdate(input: {
  trackerName: string;
  microBattleName: string;
  tacticName: string;
  expectedOutcome: string;
  currentStatus: string;
  updateText: string;
}): Promise<
  ActionResult<{
    executionInsight: { signal: string; text: string } | null;
    outcomeInsight: { signal: string; text: string } | null;
    suggestedStatus: string | null;
    rationale: string;
  }>
> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot draft insights." };
  if (!input.updateText.trim()) return { ok: false, error: "Paste an update first." };

  const skill = loadSkill("tactic-update-insight");
  const prompt = `${skill}

## Tactic context

Tracker: ${input.trackerName}
Micro-battle: ${input.microBattleName || "(unnamed)"}
Tactic: ${input.tacticName || "(unnamed)"}
Expected outcome: ${input.expectedOutcome || "(not recorded)"}
Current status: ${input.currentStatus}

## Pasted update

${input.updateText}

## Required JSON output schema

{
  "executionInsight": { "signal": "RISK"|"WATCH"|"ON_TRACK"|"OPPORTUNITY"|"NONE", "text": string } | null,
  "outcomeInsight": { "signal": "RISK"|"WATCH"|"ON_TRACK"|"OPPORTUNITY"|"NONE", "text": string } | null,
  "suggestedStatus": "Open"|"Active"|"Done"|"TBD" | null,
  "rationale": string
}

Return ONLY the JSON object, no markdown fences, no other text.`;

  let raw: string;
  try {
    raw = await generateJson(prompt);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gemini call failed." };
  }

  const parsed = parseJson<unknown>(raw);
  const result = tacticUpdateInsightSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: "Gemini returned an unexpected shape — try rephrasing the update." };
  }
  return { ok: true, data: result.data };
}

// Direct Strategy-vs-Outcome generation grounded on the tracker's CURRENT
// structured draft data (goals, OKRs, tactics + their insights) rather than
// raw ingestion events — for use right on the edit page, on demand, without
// needing an ingestion/review pipeline run first. Reuses the same
// tracker-synthesis skill Stage 2 uses for the ingestion-driven version.
export async function draftStrategyVsOutcome(input: {
  trackerName: string;
  strategyGoals: string[];
  okrs: { title: string; metrics: string }[];
  existingStrategyInsights: { title: string; description: string }[];
  tactics: {
    microBattleName: string;
    name: string;
    status: string;
    expectedOutcome: string;
    executionInsights: { signal: string; text: string }[];
    outcomeInsights: { signal: string; text: string }[];
  }[];
}): Promise<ActionResult<{ insights: { title: string; description: string }[] }>> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (!canWrite(user.role)) return { ok: false, error: "Your role cannot draft insights." };

  const skill = loadSkills(["tracker-synthesis"]);
  const prompt = `${skill}

## Tracker context

Tracker: ${input.trackerName}

Strategy goals:
${input.strategyGoals.map((g) => `- ${g}`).join("\n") || "(none recorded)"}

OKRs:
${input.okrs.map((o) => `- ${o.title}${o.metrics ? ` (${o.metrics})` : ""}`).join("\n") || "(none recorded)"}

Existing Strategy-vs-Outcome cards (propose an updated set):
${input.existingStrategyInsights.map((s) => `- ${s.title}: ${s.description}`).join("\n") || "(none yet)"}

Execution tactics and their recorded insights (this IS the "outcome" side — ground everything in what's actually here, don't invent new tactics or results):
${
  input.tactics
    .map(
      (t) =>
        `- [${t.microBattleName}] ${t.name} (status: ${t.status}, expected: ${t.expectedOutcome || "n/a"})\n` +
        t.executionInsights.map((i) => `  execution(${i.signal}): ${i.text}`).join("\n") +
        (t.executionInsights.length ? "\n" : "") +
        t.outcomeInsights.map((i) => `  outcome(${i.signal}): ${i.text}`).join("\n"),
    )
    .join("\n") || "(no tactics defined)"
}

## Required JSON output schema

{ "insights": [ { "title": string, "description": string } ] }

Return ONLY the JSON object, no markdown fences, no other text.`;

  let raw: string;
  try {
    raw = await generateJson(prompt);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gemini call failed." };
  }

  const parsed = parseJson<unknown>(raw);
  const result = strategyVsOutcomeDraftSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: "Gemini returned an unexpected shape — try again." };
  }
  return { ok: true, data: result.data };
}
