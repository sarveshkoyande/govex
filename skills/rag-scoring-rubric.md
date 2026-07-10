# Skill: RAG Scoring Rubric

## What this does
Assigns or justifies a Red/Amber/Green status for a tracker (or a specific
micro-battle/tactic) against an explicit, repeatable rubric — so a RAG call
is a documented judgment, not a vibe.

## Instructions
Apply this rubric in order; the first condition that matches wins:

- **RED** if any of: a hard deadline has already passed without the
  expected outcome; an Open risk with High severity has no mitigation; two
  or more execution insights in the same area are tagged RISK; a key
  financial metric is materially behind plan (>15% variance) with no
  recovery plan mentioned.
- **AMBER** if any of: progress exists but is behind the stated target
  (measurable gap, not just "slower than hoped"); a risk has a mitigation
  but it depends on something not yet confirmed; execution insights are
  mixed (some ON_TRACK, some WATCH) with no clear resolution timeline.
- **GREEN** only if: the available execution insights and financials
  support the stated target with no open High-severity risk lacking
  mitigation, and no material unresolved contradiction.
- If there isn't enough data to apply the rubric confidently, say so
  explicitly — do not default to Amber as a safe middle ground; state what
  specific information is missing to make the call.

Always show your work: name the specific fact(s) that triggered the
condition you matched, not just the resulting color.
