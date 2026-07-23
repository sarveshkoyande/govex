# Skill: Unresolved Entity Classification

## What this does
Given a piece of ingested text and a list of capitalized phrases pulled from it by deterministic regex (candidates that did NOT match anything already in the org's entity registry — see lib/entityRegistry.ts and lib/entityExtraction.ts), classifies which of those phrases genuinely name a specific person, a specific named project/initiative, or a specific external organization worth tracking, versus generic capitalized noise (team names, jargon, headers, sentence-initial words the regex over-caught).

This is the judgment step in an otherwise fully deterministic pipeline — it does NOT invent candidates, it only labels ones already extracted verbatim from the text. Every `term` you return must be copied exactly from the candidate list; never introduce a phrase that wasn't given to you.

## Instructions
- `isEntity: true` means: this phrase, in context, clearly refers to one specific named person, one specific named project/initiative, or one specific external organization — the kind of thing that would deserve its own row/page. "Marcus Webb" in "loop in Marcus Webb from the platform team" is a person. "Project Zeus" in "once Project Zeus ships" is a project. "Pfizer" in "waiting on sign-off from Pfizer" is an organization.
- `isEntity: false` means: generic team/department names ("Platform Team", "Finance"), role titles without a name ("the Delivery Lead"), meeting/document jargon, or sentence-initial capitalization the regex mistook for a proper noun.
- `entityType`: "PERSON" for a named individual, "PROJECT" for a named initiative/program/workstream, "ORGANIZATION" for a specific external company/vendor/agency/regulator/partner named in the text (NOT the reader's own org, and NOT an internal team), "OTHER" for anything else (still return it, just with `isEntity: false` unless there's a genuine reason to track it that doesn't fit PERSON/PROJECT/ORGANIZATION).
- Distinguishing ORGANIZATION from PROJECT: an organization is a standing external party you interact with (a company, agency, regulator); a project is a bounded initiative/workstream. "Accenture" is an organization; "the Accenture Migration" is a project.
- `confidence`: how clearly the surrounding text supports the classification — a name introduced with a role ("Marcus Webb from the platform team") should score high; a bare capitalized word appearing once with no clarifying context should score low even if you guess PERSON.
- Judge every candidate from the context it appears in in the text — do not judge a name in isolation from general world knowledge (you don't know if "Marcus Webb" is a real person; you're judging whether THIS TEXT treats it as one).
- Return every input candidate exactly once, even the ones you're rejecting — omitting one is not the same as marking it `isEntity: false`, and the caller needs every candidate labeled to avoid re-asking about it later.
