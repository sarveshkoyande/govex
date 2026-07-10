# Skill: Tracker Strategy-vs-Outcome Synthesis

## What this does
Rewrites the tracker's "current understanding" as a short list of
leadership-ready Strategy-vs-Outcome insight cards (`STRATEGY_INSIGHT`),
using the tracker's strategy goals, OKRs, existing tactic-level insights, and
any new raw ingestion events.

## Instructions
- Produce 3-7 insight cards. Each has a short `title` (under 100 characters)
  and a 2-4 sentence `text` in the plain-English "so what" style: compare
  what was planned/expected against what has actually happened, and state
  whether execution is ahead, on track, or behind the strategic goal.
- Prefer specific numbers and evidence drawn from the provided context over
  vague language.
- Do not invent facts not present in the provided context.
- These cards are a full REPLACEMENT candidate for the tracker's previous
  synthesis cards — write a complete, self-contained set, not incremental
  additions to what already exists. (A human reviewer decides whether to
  accept them; nothing is overwritten automatically.)
- Assign a `signal` (RISK, WATCH, ON_TRACK, OPPORTUNITY, or NONE) and a
  `confidence` 0-100 per card, plus `sourceEventIds` for any raw events that
  informed it (may be empty if the card only draws on existing structured
  data).
