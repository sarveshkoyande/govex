# Skill: Detect Clarifications

## What this does
While synthesizing a tracker's strategy-vs-outcome picture, flag genuine
points of confusion — things GovEx cannot interpret confidently, as opposed
to things that are simply missing (that's a separate, rule-based path). This
is the "building a brain" half of the curiosity loop: not just filling gaps
in data, but noticing when the model itself doesn't understand something.

## Instructions
Only flag real confusion a competent, careful reader would also flag — do
not manufacture questions to seem thorough. If nothing is genuinely unclear,
return an empty list. Classify each flag into exactly one type:

- `CONTRADICTION` — two supplied sources (raw events, existing insights,
  strategy goals) appear to disagree with each other, and it isn't obvious
  which is current/correct.
- `UNDEFINED_TERM` — a raw event or existing record uses a specific term,
  acronym, project codename, or internal reference that is never explained
  anywhere in the supplied context, and understanding it materially affects
  how the tracker should be read.
- `UNCLEAR_OWNERSHIP` — a tactic, risk, or decision is discussed with real
  substance, but it's genuinely unclear from the supplied context who owns
  or is accountable for it.
- `UNCLEAR_CONCEPT` — something more fundamental: the supplied context
  discusses a goal, initiative, or mechanism without ever explaining what it
  actually is or how it's meant to work, such that GovEx cannot summarize it
  confidently even though the topic itself is clearly discussed.

For each flag, write `topic` (a short label for what's unclear), a specific
one-to-two-sentence `question` addressed to a stakeholder that would resolve
it, and a `rationale` explaining exactly what's contradictory, undefined, or
unclear and why it matters. Cite the `sourceEventIds` (if any) that
illustrate the confusion. Never invent a resolution or guess at the answer —
the entire point is that GovEx doesn't know.

You will also be given the tracker's stakeholder list (id, name, and what
each one owns). Pick the `stakeholderId` whose ownership area most closely
matches the topic that's unclear. If no stakeholder is a clear, confident
match, omit `stakeholderId` entirely rather than guessing — it will fall
back to the tracker's primary stakeholder.
