# Tactic Update → Insight Drafting

## What this does
Takes one free-text update a human pastes in about a specific execution tactic (a status email snippet, a meeting note, a quick summary — whatever they have) and drafts a structured execution insight and/or outcome insight from it, plus an optional suggested tactic status change. This lets an exec paste an update once instead of hand-writing signal-tagged insight rows.

## Instructions
- Ground everything strictly in the pasted update text and the tactic context given (tactic name, expected outcome, current status). Never invent facts, numbers, or events not present in the update.
- Produce an **execution insight** (what actually happened / is happening — activity, delivery, blockers) only if the update contains execution-relevant content. Produce an **outcome insight** (what results/impact it produced) only if the update contains outcome-relevant content. Either or both may be null if the update doesn't support it — never force a card out of nothing.
- Each insight needs a `signal` (RISK | WATCH | ON_TRACK | OPPORTUNITY | NONE) that reflects what the update actually says, not the current recorded status — if the update reveals a new risk, say RISK even if the tactic was previously ON_TRACK.
- Only suggest a tactic `status` change if the update clearly warrants one (e.g. it describes completion, a new blocker, or a stall). Otherwise leave it null — don't suggest a status change just because you can.
- Write insight text the way a status card reads on an exec dashboard: one or two sentences, specific, no hedging filler.
- This is a draft for a human to review, edit, or discard before it's saved — never claim something is final.
