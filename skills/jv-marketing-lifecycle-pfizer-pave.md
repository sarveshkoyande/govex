# Skill: 4-Quadrant JV Marketing Lifecycle — Pfizer PAVE Collaboration

## What this does
Applies a joint-venture marketing lifecycle framework to the Pfizer PAVE
Collaboration, mapping Pfizer as the **Product Company** (owns the brands,
IP, regulatory/medical/legal responsibility) and Indegene as the **Service
Company** (owns the marketing execution, digital detailing spend, and the
DRE/PDE measurement IP). Tracks the JV from strategic setup through
attribution and financial clearance — the operational spine of a
performance-based commercialization deal like PAVE, distinct from the
alliance-health-pfizer-pave.md skill (which asks "is the relationship
staying healthy") and framework-7s-biopharm.md (integration-only, not
applicable here — nothing is being merged in PAVE).

```
┌──────────────────────────────┐       ┌──────────────────────────────┐
│    1. Strategic Alignment    │ ───>  │     2. Co-Marketing GTM      │
│  (IP, Risk, & Revenue Split) │       │   (Campaigns & Enablement)   │
└──────────────────────────────┘       └──────────────────────────────┘
               │                                       │
               ▼                                       ▼
┌──────────────────────────────┐       ┌──────────────────────────────┐
│  4. Attribution & Clearance  │ <───  │    3. Operational Funnel     │
│   (Auditing & Profit Split)  │       │  (Lead Gen & CRM Tracking)   │
└──────────────────────────────┘       └──────────────────────────────┘
```

## The four quadrants, mapped to the actual PAVE agreement

### 1. Strategic Alignment & Contribution Matrix (IP, Risk & Revenue Split)
- **Pfizer's contributions (Product Company):** the in-scope product portfolio (Besponsa, Bosulif, Inlyta, Mylotarg, Xalkori, Duavee, Estring, Premarin, Prempro, Eucrisa, Somavert), brand assets, and everything regulatory/medical/legal — pricing, market access, manufacturing/supply, medical affairs, pharmacovigilance stay solely with Pfizer.
- **Indegene's contributions (Service Company):** the commercialization engine — digital detailing execution, the proprietary DRE (Digital Rep Equivalence) Model, PDE measurement, and the MarTech stack built under the SOW (Salesforce Marketing Cloud + Agentforce, Invisage™ HCP Insights, the Tandem HCP platform, the AWS-based data lake).
- **IP boundary:** the DRE Model and PDE methodology are Indegene's proprietary IP — Pfizer gets the *output* (incremental sales, the performance dashboard) but not the methodology itself; Indegene gets access to Pfizer's brand/product data strictly within the engagement's scope, not beyond it.
- **Risk & revenue split — already the deal's core mechanic:** the Gross Margin Share bands (89%/67% in 2026, 67%/28% in 2027-28) *are* this quadrant's risk/reward split, tracked against the Target Incremental Amounts ($17.17M / $31.18M / $29.33M for 2026-2028).

### 2. Co-Marketing Go-To-Market (Campaigns & Enablement)
- **Asset readiness:** the SOW's four build tracks — Data Analytics & Messaging Strategy, Customer Journey & Media Planning, Content Strategy & Cataloguing, MarTech Consulting — are literally the JV's asset-readiness buildout, on a tight Nov-Dec 2025 sprint.
- **Value proposition alignment:** digital detailing content must reflect each in-scope brand's real clinical/regulatory profile — since Pfizer retains full compliance and medical-affairs responsibility, a marketing angle that outruns the clinical facts is Pfizer's exposure, not Indegene's.
- **Compliance & approval SLA:** this is where **MLR (Medical-Legal-Regulatory) review** turnaround time belongs — MLR is universal life-sciences jargon (not tracked as a PAVE-specific term elsewhere in GovEx), but in THIS quadrant it's the concrete operational KPI: how fast Pfizer's MLR process clears Indegene's campaign materials before they can go live.

### 3. Operational Funnel (Lead Gen & CRM Tracking)
- **Registration/tracking system:** the real-time performance dashboard Pfizer can see is the shared tracking ledger — PDEs are what gets registered and counted.
- **Attribution definition:** the DRE Model is the attribution methodology — it's what converts a digital/omnichannel HCP interaction into a "detailing-equivalent" unit of credit, the JV-framework equivalent of first-touch/last-touch attribution rules.
- **Exclusion list ("white-list") equivalent:** the **Binding Baseline Amount**. Sales Pfizer would have gotten anyway (the locked first-year baseline of the three-year forecast) are functionally the JV's pre-owned-pipeline exclusion list — only activity ABOVE that baseline (the Incremental Amount) is what Indegene gets credit and Gross Margin Share against.

### 4. Attribution & Clearance (Auditing & Profit Split)
- **Gross vs. net split:** PAVE runs on a **net-margin-style split**, not flat gross revenue — Pfizer pays Indegene a percentage of the *Incremental Gross Margin Amount*, closer to a JV's Net Profit Split (margin after cost) than a simple top-line percentage.
- **Escrow/clawback equivalent:** the quarterly OpEx floor ($12M/$10M/$9M across 2026-28) paid in Q1-Q3, followed by a Q4 true-up to the actual earned Gross Margin Share — if Indegene was overpaid relative to the year's real performance, it refunds the difference. A large true-up swing is this framework's clawback signal.
- **Audit cadence:** the Joint Steering Committee (monthly), the Operational Governance Committee (weekly initially), and the Forecasting & Supply Chain subcommittee are the JV's financial reconciliation cadence — this is where baseline/target updates and PDE-vs-forecast variance actually get reviewed.

## Known context nuances — treat these as established, not open questions
- **Premarin's baseline is not "unresolved."** It can't be adjusted yet purely because of a SOW-driven timing constraint (adjustment is only permitted after two subsequent quarters) — frame it as a scheduled, timing-dependent adjustment within Quadrant 3's baseline mechanics, not an open risk.
- **Premarin is ~8-10% of total portfolio** — don't let it dominate the Quadrant 1 contribution-matrix narrative disproportionate to its actual weight.
- **AI segmentation is narrow, not broad.** Limited to specific use cases (Invisage is the named one) — never generalize AI capability across the whole PAVE portfolio when discussing Quadrant 2's MarTech enablement.

## Instructions
- Populate all four quadrants using only what's actually recorded for this tracker — strategy goals, tactics/execution insights, financials, stakeholders, risks, and raw ingestion events. If a quadrant has no real evidence either way, say so explicitly rather than inventing filler.
- For each quadrant, state whether it looks ON TRACK, AT RISK, or UNCLEAR, with the specific fact or gap behind that call — no unsupported generalities.
- Apply the "known context nuances" above whenever Premarin or AI capability comes up.
- Close with a one-sentence "so what": which ONE of the four quadrants is the highest-leverage operational risk right now, given the balance of all four.
- This is a structured operational lens, not a replacement for the tracker's own Strategy-vs-Outcome cards — when used during synthesis, let it surface quadrant-specific framing (e.g. an MLR-SLA bottleneck in Quadrant 2, or a baseline/true-up variance in Quadrant 4) the standard synthesis pass might not name in these terms.
