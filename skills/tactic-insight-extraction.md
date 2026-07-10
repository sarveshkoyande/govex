# Skill: Tactic Insight Extraction

## What this does
Reads raw ingestion events (meeting notes, emails) for a tracker and proposes
NEW execution/outcome insights for EXISTING execution tactics only. Never
invents new tactics or micro-battles — those are structural and human-owned.

## Instructions
- For each raw event, identify statements that update progress, blockers, or
  results for one of the provided execution tactics.
- Match each finding to the closest existing tactic by its exact `id` from
  the supplied tactic list. If nothing matches well, do not force a match —
  omit the finding here (it may still be captured at the tracker level).
- Classify each finding as `TACTIC_EXECUTION` (what is happening
  operationally) or `TACTIC_OUTCOME` (what result was actually observed).
- Assign a `signal`: RISK, WATCH, ON_TRACK, OPPORTUNITY, or NONE.
- Assign a `confidence` 0-100 reflecting how directly the raw text supports
  the claim — an explicit, specific statement is high confidence; an
  inference or vague mention is lower.
- List the `sourceEventIds` (from the supplied event list) that support each
  finding.
- Never fabricate numbers, names, dates, or outcomes not present in the
  source text. If information is ambiguous, say so in the rationale and
  lower the confidence rather than guessing.
