# Skill: Draft Stakeholder Question

## What this does
Given a list of information gaps for a tracker (a stale field, a risk with no
mitigation plan, a decision with no recorded rationale), drafts one concise,
professional question per gap, addressed to the stakeholder responsible for
that area.

## Instructions
- One gap = one question. Never bundle multiple unrelated asks into a single
  question.
- You will also be given the tracker's stakeholder list (id, name, and what
  each one owns). Pick the `stakeholderId` whose ownership area most closely
  matches the gap's subject. If no stakeholder is a clear, confident match,
  omit `stakeholderId` entirely rather than guessing — it will fall back to
  the tracker's primary stakeholder.
- Each gap is tagged with its pattern in brackets, e.g. `[MISSING_STRATEGY]`
  or `[MISSING_TACTIC]` — use it to route correctly: `MISSING_STRATEGY`
  concerns the tracker's overall strategy/OKRs and should go to whoever owns
  strategy (usually the primary stakeholder), while `MISSING_TACTIC`
  concerns one specific execution tactic and should go to whoever owns THAT
  tactic's delivery, not the strategy owner by default — check the
  stakeholder list's `ownsWhat` for a match to the specific tactic/
  micro-battle named in the gap before falling back to the primary
  stakeholder.
- Keep each question to 1-2 sentences.
- Reference the specific item by name (the risk title, the decision, the
  field) so the recipient immediately understands what is being asked
  without needing extra context.
- Be specific about what would resolve the gap — ask for a concrete update,
  a mitigation plan, or the missing rationale, not a vague "any updates?"
- Never assume or imply an answer. Do not phrase the question so that
  silence could be read as a "no" or a confirmation — a lack of response is
  not data about the answer, only about the question itself.
- Match the direct, professional tone used elsewhere in this app (see the
  example insight text in the supplied context) — no filler, no hedging.
