# GovEx Command Center — Stage 0

Stage 0 skeleton per `PROJECT_PHILOSOPHY.md`: real authentication, a UI shell that
replicates the sample dashboard, the tracker/theme data model (with the full
strategy hierarchy + first-class financials + per-field confidence/history), and
manual create/edit/delete CRUD on trackers. **No AI, no ingestion, no
integrations** — those are Stage 1+.

## Stack
- Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui
- Auth.js (NextAuth v5) — email/password (Credentials), **swappable to Keycloak 10.0.2 (OIDC)** later
- Prisma + SQLite (Postgres-ready via a provider swap)

## Run it locally

```bash
cd govex-app
npm install
cp .env.example .env        # a working .env is already included for local dev

npm run db:generate         # generate the Prisma client
npm run db:migrate          # create the SQLite schema (name the migration e.g. "init")
npm run db:seed             # seed org, admin user, domains, and 2 example trackers

npm run dev                 # http://localhost:3000
```

Then open http://localhost:3000 — you'll be redirected to `/login`.

**Seeded admin login:**
- Email: `admin@govex.local`
- Password: `ChangeMe123!`

## Verify Stage 0 end-to-end
1. **Auth** — visit any page → redirected to `/login`. Sign in with the seeded
   admin. Use the avatar menu (top-right) to **Sign out** and confirm you're
   bounced back to `/login`.
2. **UI shell** — header, top-nav domain tabs, portfolio-health bar, signal
   summary, tracker cards, and the right-hand Action Tracker rail all render in
   the sample's styling.
3. **Manual CRUD**
   - Click **New Tracker**, fill Overview + add financials/stakeholders/risks/
     actions/decisions and a Strategic Priority → Micro-Battle → Tactic/Outcome/
     Insight. **Create Tracker** → lands on the detail page.
   - **Edit** it, change the Signal or a financial, **Save** → the change appears
     under **Field Change History** on the detail page (append-only).
   - **Delete** from the edit page → returns to the dashboard.

## Handy scripts
- `npm run db:studio` — browse the SQLite data in Prisma Studio
- `npm run db:reset` — drop + re-migrate + re-seed

## Notes / Stage-0 scope calls
- The Action Tracker rail is **read-only** in Stage 0; actions are managed on the
  tracker edit page (actions are a tracker field). Clicking an action jumps to
  its tracker.
- Every tracked field carries `confidence` + `source` (`MANUAL` now) and every
  change is logged to `FieldChange`, so Stages 2–4 (Gemini synthesis, confidence
  decay, contradiction detection) have the structure they need without a rewrite.
- Moving to Postgres: change `datasource.provider` to `postgresql` in
  `prisma/schema.prisma`, point `DATABASE_URL` at Postgres, re-migrate.
