# GovEx — session handoff

For a fresh chat picking this up. Read this first, then check `git log` for
exact commit-level detail — every change this session has a real commit
message explaining what and why.

## Deployment

- Live app: `https://govex-alpha.vercel.app`
- DB: Neon Postgres (free tier), connected via `DATABASE_URL` in `.env` (not committed)
- Repo: `https://github.com/sarveshkoyande/govex.git`, branch `main`
- Login: `admin@govex.local` — password is whatever's currently set; if unknown, reset via `npm run db:seed` (safe — it upserts the admin user, though it errors partway through on an unrelated `domain.deleteMany` FK issue after the upsert succeeds, which is fine, ignore it)
- Ingestion API token: exists in the DB (`IngestionApiKey`, label "Default (seed)") — the raw token value is only ever shown once at creation and isn't stored in plaintext; if you need a fresh one, regenerate via Settings → Ingestion Keys

## What's built and verified working (this session)

1. **Framework-skill structured output** — 7S/SWOT/etc. skills return zod-validated JSON (`lib/validation/framework.ts`), rendered as a real card in chat instead of trusting free-text prose.
2. **Unresolved-entity pipeline** (`lib/entityExtraction.ts`) — regex candidate extraction → Gemini NER classification → promotion once a term crosses a 2-occurrence threshold. Three target types: PERSON → `Stakeholder`, PROJECT → `MicroBattle`, OTHER → `OrgTerm`.
3. **Auto-promotion, admin-toggleable** — `Organization.autoPromoteEntities` (default `true`) — matches OpenKB's auto-compile behavior by default; toggle at Settings → Entity Promotion reverts to human-confirm via the on-page "Unresolved Entities" panel.
4. **File ingestion** — `/api/ingest` accepts `fileName` + `fileBase64` (txt/md/docx/pdf/pptx), extracted server-side (`lib/fileExtraction.ts`).
5. **OneDrive/SharePoint pull-sync** — `/api/drive-sync/compare` does existence-based dedup (`DriveSyncedFile` ledger) so a Power Automate flow only fetches new files. Pull-triggered by a "Sync OneDrive" button, never a standing watcher. Files stay in SharePoint — only extracted text is stored in GovEx's DB.
6. **Conceptual cross-linking** (`rebuildConceptualMentions`) — was built long ago but never actually wired into the app (only ran via a stale local script). Now fires automatically whenever a `CONTEXT_DOC` is ingested. Verified live: found real, specific 95%-confidence connections between the two seeded trackers.
7. **PageIndex-style document tree** (`lib/pageIndex.ts`) — a real hierarchical tree (not flat chunking), parsed from numbered section headings. Used in exactly one place: trimming an "other" tracker's context doc before the conceptual-linking Gemini comparison. **Not used anywhere else** (not in synthesis, not in chat's raw-event retrieval).
8. **Knowledge graph** — swapped from `force-graph` to Sigma.js + graphology + forceAtlas2 (animated, non-blocking layout; hover-only labels; STRUCTURAL/hub edges default off since the view is already ego-filtered to one tracker).
9. **`get_tracker_connections` chat tool** — the chat agent can now actually query the conceptual/dictionary links the graph renders, instead of having zero access to that data. Verified live via a real chat question.
10. **Bug fixes caught by live testing, not assumed correct**: a Vercel+Prisma stale-client issue (`prisma generate` wasn't in the build script), a real concurrency race duplicating auto-promoted entities (fixed with `promoteCandidate()`'s existence-check), a middleware allowlist gap that 401'd the new compare endpoint, a tree-traversal bug that pruned a relevant subsection under a generically-titled parent.

## Known gaps — NOT built, be honest about this with the user

- **No persistent "concept/entity page" layer.** GovEx's graph nodes are bare (a label + one snippet). Real OpenKB compiles narrative, continuously-updated entity pages (people/orgs/places/products) that chat then reads from. GovEx has nothing like this — every chat answer is re-derived live from raw search (`search_raw_events` summaries → `get_raw_event` full text), never from a pre-compiled page.
- **PageIndex tree is narrowly scoped** — only used for conceptual-linking prompt trimming, not synthesis (`lib/synthesis.ts` still dumps full raw text of every event) or chat's raw-event retrieval.
- **Only PERSON has a full promotion loop with obvious value** — PROJECT (→MicroBattle) and OTHER (→OrgTerm) work but aren't rendered as graph nodes at all.
- **`EntityMention` rows are never cleaned up after resolution** — a promoted entity's old `UNRESOLVED` mention rows stay in the DB forever with a stale `targetType`. Exclusion is computed live at query time (checked against the current registry), not by updating the stored row.
- **Vercel/Neon cold-start latency** is real and separate from any app bug — first request after idle is slow, nothing to fix, just how the free tiers behave.

## If continuing toward full OpenKB parity

The next real, scoped feature (discussed but not started) is the concept-page layer: a new model holding a running narrative summary per entity, a compile-on-ingest step that updates it, and rewiring chat to read from it instead of live-searching raw events every time. This is a genuinely separate, larger build — don't assume it's a quick add-on to what exists.

## Working conventions this session established

- Always verify claims against real code/DB, never assert from memory — this session caught multiple real bugs exactly by insisting on live testing over assumed-correct.
- `git push` sometimes hangs on a Windows Credential Manager prompt — retry `GIT_TERMINAL_PROMPT=0 git push origin main`, and if it still hangs, the credential cache likely expired and needs the user to re-auth interactively.
- Local dev machine sometimes runs low on memory (`tsc`/build can OOM) — a real environment constraint, not a code issue; retry or note it and move on.
- The top-level `C:\Users\Admin\Desktop\govex\` folder (docs, .docx context notes) is read-only reference material — never modify it, only `govex-app/` is the actual build.
