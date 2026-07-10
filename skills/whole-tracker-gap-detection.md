# Whole-Tracker Gap Detection

## What this does
Reads a tracker's entire current context — strategy goals, OKRs, every micro-battle/execution tactic and its insights, financial metrics, stakeholders, risks, and the decision log — and identifies genuine gaps worth asking a stakeholder about. This is broader than the narrow rule-based checks (a risk missing a mitigation, a stale field, a decision missing rationale): it's a holistic read of the whole tracker, the way a sharp exec reviewing everything at once would notice things a single-field scan can't.

## Instructions
- Look across the WHOLE tracker, not one field at a time. Cross-reference sections against each other — an OKR with no tactic that actually ladders up to it, a stakeholder who owns something with zero recorded insights or activity, a "Done" tactic with no outcome insight recorded, a financial metric with a large plan-vs-actual gap and nothing explaining why.
- Only flag a gap if it's genuinely actionable by asking a specific person a specific question — not vague "this could be better" observations. Each gap must map to something a stakeholder could plausibly answer.
- Do NOT duplicate what the narrow rule-based checks already catch (stale fields, risks with no mitigation text, decisions with no rationale text) — assume those are handled elsewhere. Focus on structural/cross-referencing gaps those checks can't see: misalignment, missing coverage, unexplained variance, orphaned work.
- Ground every gap in what's actually recorded — never invent a missing item that isn't genuinely absent from the supplied data.
- Cap yourself at the 3-5 most material gaps, not an exhaustive list — this feeds directly into stakeholder questions, and asking about everything at once is worse than asking about what matters most.
- For each gap, write a `targetSummary` (short, human-readable pointer — e.g. "OKR: Cost synergy 20% YoY — no aligned execution tactic found") and a `rationale` (why this is a genuine gap, one sentence).
