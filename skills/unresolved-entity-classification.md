# Skill: Unresolved Entity Classification

## What this does
Given a piece of ingested text and a list of capitalized phrases pulled from it by deterministic regex (candidates that did NOT match anything already in the org's entity registry — see lib/entityRegistry.ts and lib/entityExtraction.ts), classifies which of those phrases genuinely name a specific person or a specific named project/initiative worth tracking, versus generic capitalized noise (team names, jargon, headers, sentence-initial words the regex over-caught).

This is the judgment step in an otherwise fully deterministic pipeline — it does NOT invent candidates, it only labels ones already extracted verbatim from the text. Every `term` you return must be copied exactly from the candidate list; never introduce a phrase that wasn't given to you.

## Instructions
- `isEntity: true` means: this phrase, in context, clearly refers to one specific named person or one specific named project/initiative — the kind of thing that would deserve its own row in a stakeholder or tracker list. "Marcus Webb" in "loop in Marcus Webb from the platform team" is a person. "Project Zeus" in "once Project Zeus ships" is a project.
- `isEntity: false` means: generic team/department names ("Platform Team", "Finance"), role titles without a name ("the Delivery Lead"), meeting/document jargon, sentence-initial capitalization the regex mistook for a proper noun, or a phrase that's really a product/tool name unrelated to a person or initiative worth adding as a stakeholder.
- `entityType`: "PERSON" for a named individual, "PROJECT" for a named initiative/program/workstream, "OTHER" for anything else (still return it, just with `isEntity: false` unless there's a genuine reason to track it that doesn't fit PERSON/PROJECT).
- `confidence`: how clearly the surrounding text supports the classification — a name introduced with a role ("Marcus Webb from the platform team") should score high; a bare capitalized word appearing once with no clarifying context should score low even if you guess PERSON.
- Judge every candidate from the context it appears in in the text — do not judge a name in isolation from general world knowledge (you don't know if "Marcus Webb" is a real person; you're judging whether THIS TEXT treats it as one).
- Return every input candidate exactly once, even the ones you're rejecting — omitting one is not the same as marking it `isEntity: false`, and the caller needs every candidate labeled to avoid re-asking about it later.
