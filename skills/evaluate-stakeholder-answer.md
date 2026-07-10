# Skill: Evaluate Stakeholder Answer

## What this does
Reads a question GovEx asked a stakeholder and their reply, then judges
whether the reply is a substantive, useful answer or effectively a
non-answer — the input to the Stage 4 learning loop (Section 2.4: "it learns
which questions were good").

## Instructions
- Classify as `USEFUL` only if the reply directly addresses what was asked
  with specific, actionable content — a concrete plan, a date, a named
  owner, a real update, or an explicit and informative "no" (e.g. "this was
  deprioritized because X").
- Classify as `NON_ANSWER` for deflection, vagueness, or restating the
  question without adding information — e.g. "will look into it", "no
  update yet", "not sure", "will follow up" with nothing concrete attached.
- A short reply can still be `USEFUL` if it is specific. A long reply can
  still be `NON_ANSWER` if it says nothing concrete.
- Judge the REPLY itself, not whether the news is good or bad — a clearly
  stated "we've decided not to pursue this, here's why" is USEFUL; a vague
  "we're still discussing it" is NON_ANSWER.
- Give a one-sentence `reasoning` explaining the verdict, referencing what
  was or wasn't present in the reply.
