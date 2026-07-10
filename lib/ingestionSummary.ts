import { prisma } from "@/lib/db";
import { loadSkill } from "@/lib/skills";
import { generateText } from "@/lib/gemini";

const MIN_SUMMARY_CHARS = 100;
const MAX_SUMMARY_CHARS = 600;

// Called once, automatically, right after an event is ingested (fire-and-
// forget, same pattern as evaluateAnswer). Never throws — a summarization
// failure must not affect ingestion; the manifest falls back to a plain
// truncation for any event whose summary is still null.
export async function summarizeIngestionEvent(eventId: string): Promise<void> {
  const event = await prisma.rawIngestionEvent.findUnique({ where: { id: eventId } });
  if (!event) return;

  const targetChars = Math.min(MAX_SUMMARY_CHARS, Math.max(MIN_SUMMARY_CHARS, Math.round(event.rawText.length / 10)));

  const skill = loadSkill("ingestion-summary");
  const prompt = `${skill}

## Target length
Approximately ${targetChars} characters.

## Source (${event.source}${event.subject ? `, subject: "${event.subject}"` : ""}, occurred ${event.occurredAt.toISOString()})

${event.rawText}

Return ONLY the summary text — no preamble, no markdown, no quotes around it.`;

  try {
    const summary = await generateText(prompt);
    await prisma.rawIngestionEvent.update({ where: { id: eventId }, data: { summary: summary.trim() } });
  } catch (err) {
    console.error("[summarizeIngestionEvent] failed for", eventId, err instanceof Error ? err.message : err);
  }
}
