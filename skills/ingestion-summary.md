# Ingestion Summary

## What this does
Produces a compact, faithful summary of one raw ingestion event (an email, a meeting note, a stakeholder reply) right after it's ingested. This summary is what the chat orchestrator reads first when deciding whether an unreviewed contribution is relevant to a question — never the full raw text, and never a blind character truncation (a fixed truncation is meaningless for anything longer than a sentence or two, cutting a multi-paragraph meeting note off mid-thought).

## Instructions
- Summarize proportionally to the source length: roughly one-tenth of the original character count, with a floor around 100 characters (so short notes still get a real sentence, not nothing) and a ceiling around 600 characters (so a long transcript doesn't produce a "summary" too long to scan quickly).
- Preserve concrete specifics — names, numbers, dates, decisions — over vague paraphrase. "Discussed budget" is useless; "Q3 spend is $200K over plan, JSC to review Oct 15" is the target quality.
- If the raw text covers multiple distinct topics, cover the 2-3 most material ones rather than trying to compress everything evenly.
- Plain prose, no markdown formatting, no preamble ("This email discusses...") — just the substance.
- Never invent detail the source doesn't contain, even to make the summary read more smoothly.
