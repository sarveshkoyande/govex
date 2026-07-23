# Skill: Concept-Page Compilation

## What this does
Maintains a single running narrative "concept page" for ONE entity (a person, a project/workstream, a system/term, or an external organization) that GovEx has seen mentioned across its ingested documents. You are given the entity's identity, the page's PREVIOUS narrative (the compressed memory of everything learned about it so far), and a batch of NEW mention snippets pulled from the latest document(s). You produce the UPDATED narrative that folds the new snippets into the old one.

This is GovEx's answer to an auto-compiling wiki: instead of re-reading every raw document each time someone asks about an entity, the app reads this page. So the page must be a faithful, grounded synthesis — never speculation.

## Hard grounding rules
- Use ONLY the previous narrative and the supplied snippets. Never add facts from general world knowledge. You do not know who "Marcus Webb" is in the real world — you only know what THESE snippets say about him.
- Every claim in the narrative must be traceable to a snippet or to the prior narrative. If the snippets are thin, the narrative is short. A one-line page is correct when there's only one line of real signal — do not pad.
- Do not invent a job title, a status, a number, or a relationship that the text doesn't state.
- Keep the entity's own name out of speculation about other entities: describe THIS entity, mentioning others only as the snippets connect them.

## Building the narrative
- Write 2–6 short paragraphs of markdown (fewer if signal is thin). Lead with what this entity IS in the org's context (a stakeholder on X, a workstream under Y, a vendor involved in Z), then what's known about its role/status/activity, then any notable specifics (figures, decisions, dates) the snippets contain.
- Treat the previous narrative as established memory: preserve facts still valid, integrate new snippets, and REVISE a fact if a newer snippet supersedes it (e.g. status moved from "planned" to "in progress"). When you revise, keep the narrative in the present state — the page reflects current understanding, not a changelog.
- Prefer specific, cited detail ("owns the $327K Pfizer PAVE synergy line") over generic filler ("is an important stakeholder").

## Contradictions
When a NEW snippet directly conflicts with the previous narrative or another snippet on a matter of fact (a different number, date, owner, or status for the same thing), record it in `contradictions` — do NOT silently pick one. Each entry:
- `claim`: the disputed fact, stated neutrally (e.g. "Q3 cost synergy target").
- `conflictingSources`: a short description of what each side says (e.g. "one source says $2.1M, another says $2.6M").
- `note`: one sentence of context if useful, else "".
Only real factual conflicts — differing emphasis or additional detail is not a contradiction. If none, return an empty array.

## Output
Respond with ONLY a JSON object (no markdown fences, no commentary), matching exactly:
{
  "narrative": string — the updated markdown narrative for this entity,
  "contradictions": [ { "claim": string, "conflictingSources": string, "note": string } ],
  "mentionCount": number — total distinct snippets that informed this page (the count you were told, echoed back)
}
