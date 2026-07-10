# Entity Conceptual Linking

## What this does
Given one theme's profile (a tracker or domain, summarized from its context brief) and a catalog of every other theme in the org, identifies genuine thematic or structural connections that share no literal vocabulary — the kind of link dictionary/substring matching cannot find. This is the second, more expensive tier of the knowledge graph (see lib/entityExtraction.ts) — the dictionary tier already catches literal name mentions; this tier catches conceptual ones.

## Instructions
- A genuine connection means: a shared strategic pattern, a shared risk category, one theme's stated approach being explicitly modeled on another (e.g. "drawing from the PAVE collaboration playbook"), overlapping capability builds, or a comparable structural shape (e.g. both are post-merger integrations, both are performance-based partnerships). "Both involve AI" or "both are in life sciences" is NOT a genuine connection — that's true of almost everything here and adds no signal.
- Do not force a minimum number of connections. If a theme genuinely has nothing conceptually distinct to link to another, return no connection for that pair — an empty result is correct and expected, not a failure.
- Each connection needs a one-sentence reasoning that names the *specific* shared pattern — "both are M&A integrations" is too vague; "both explicitly frame their financial model as risk transferring from client to Indegene in exchange for upside share" is the right level of specificity.
- Assign a confidence 0-100 reflecting how directly stated vs. inferred the connection is. A connection based on an explicit textual reference (one brief literally naming another) should score high; a connection based on structural similarity you inferred should score lower.
- Never invent a connection to satisfy a sense that "there should be one." Ground everything in what the two profiles actually say.
