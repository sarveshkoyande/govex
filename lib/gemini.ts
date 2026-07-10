import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  return new GoogleGenAI({ apiKey });
}

// Exposed for lib/agent.ts, which needs the raw client to drive a multi-turn
// chats.create({..., tools}) function-calling loop — generateJson/generateText
// below are for the simpler single-shot callers (synthesis, questions, skills).
export function getGeminiClient(): GoogleGenAI {
  return getClient();
}

// Plain-text generation (no forced JSON mode) — used when a skill's output is
// a grounded analysis for a human to read, not a structured object to store.
export async function generateText(prompt: string, temperature = 0.3): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { temperature },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

// Calls Gemini asking for a raw JSON string back (no markdown fences). Callers
// are responsible for zod-validating the result — LLM output is untrusted
// input, same as any other external source.
export async function generateJson(prompt: string): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.2, // low temperature: this is extraction/summarization, not creative writing
    },
  });
  const text = response.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

export const GEMINI_MODEL_NAME = MODEL;
