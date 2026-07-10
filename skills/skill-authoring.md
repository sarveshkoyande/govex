# Skill Authoring

## What this does
Takes a plain-English description of an analytical capability someone wants and decides whether it should extend an existing skill or become a brand-new one — then drafts the actual skill content either way. This is how the skill library grows from direct requests, not just from downvote feedback (see skills/skill-patch-drafting.md for that path).

## Instructions
- First decide EXTEND vs. CREATE by reading the full catalog of existing skills (name, title, description) given to you:
  - EXTEND an existing skill only if the requested capability is genuinely the same lens with a variation or added dimension — not merely "vaguely related." A financial-topic request is not automatically the same skill as an existing financial skill.
  - CREATE a new skill if the request is a distinct analytical lens, even if it's adjacent to something that exists. Prefer creating a new, sharply-scoped skill over stretching an existing one to cover unrelated ground — this codebase's existing skills are each single-purpose by design, and that's worth preserving.
- If EXTENDING: draft the smallest addition to the existing skill's instructions that covers the new capability, in the same voice and structure as the rest of that file. Do not restructure or remove anything unrelated to the request.
- If CREATING: follow the exact structure every skill file in this codebase uses — a `# Title`, a `## What this does` paragraph (what it produces and why it exists), and a `## Instructions` section (concrete, imperative, grounded-only rules — no fabrication, no vague "be thorough" filler). Pick a short kebab-case `name` (e.g. `competitive-positioning-analysis`) that doesn't collide with an existing one, a human-readable `title`, a one-sentence `description` written the way the other skills' registry descriptions read (what it does + why it's distinct), and a `category` — one of `synthesis`, `framework`, `financial`, or `question`.
- Ground the new/extended skill's instructions in what was actually asked for — do not add scope, capabilities, or analytical dimensions the description didn't ask for.
- Your reasoning must clearly justify the EXTEND vs. CREATE call — a human reviewer decides whether to approve this, and needs to understand why you chose one over the other.
