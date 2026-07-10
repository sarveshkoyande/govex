import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

// Inlined rather than imported from lib/ingestion.ts — tsx runs this script
// standalone and may not resolve the app's "@/" path alias.
const generateIngestionToken = () => "govex_ingest_" + crypto.randomBytes(24).toString("hex");
const hashToken = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL ?? "admin@govex.local").toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";

const DOMAINS = [
  "BioPharm & Media", "Tectonic", "Tech (Veeva/SF/Adobe)", "DAAI", "MIRAI",
  "Pfizer Pave Deal", "Large Deal & GTM", "Delivery Excellence", "Transform AI", "Commercial AI",
];
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ── helper builders for the strategy layer ─────────────────────────────────
type Ins = [string, string]; // [signal, text]
type Tac = { name: string; outcome?: string; exec?: Ins[]; out?: Ins[] };
type Mb = { code: string; name: string; rag?: string; tactics: Tac[] };

const tacticCreate = (t: Tac, order: number) => ({
  name: t.name, expectedOutcome: t.outcome ?? null, status: "Active", order,
  insights: {
    create: [
      ...(t.exec ?? []).map(([signal, text], i) => ({ kind: "EXECUTION", signal, text, order: i })),
      ...(t.out ?? []).map(([signal, text], i) => ({ kind: "OUTCOME", signal, text, order: i })),
    ],
  },
});
const mbCreate = (m: Mb, order: number) => ({
  code: m.code, name: m.name, ragStatus: m.rag ?? "GREEN", order,
  executionTactics: { create: m.tactics.map(tacticCreate) },
});

// ── BioPharm & Media — real content ported from the sample theme page ───────
const BP_GOALS = [
  "Become a formidable, differentiated player in the Omni space",
  "Drive targeted account growth to unlock additional revenue",
  "Unlock transformative, cross-enterprise deals (Brand -> Enterprise construct)",
  "Expand Media into a fully integrated, end-to-end capability",
];

const BP_OKRS: { title: string; metrics?: string; tags?: string }[] = [
  { title: "Demonstrate synergistic growth in Omnichannel portfolio (Enterprise Omnichannel + BioPharm+AH)", metrics: "20% YoY growth" },
  { title: "Achieve targeted gross/net revenue of $53Mn and $38.5Mn respectively from Biopharm business in FY26" },
  { title: "Deliver $6Mn synergy revenue with Indegene + BioPharm solutions" },
  { title: "Seamless integration of BioPharm across 4 workstreams (Data/Project/Finance/TSA)", metrics: "$1.2Mn cost synergies + global model activation" },
  { title: "Build joint operating/pricing model for Indegene + Biopharm combined entity" },
  { title: "Ensure BioPharm + Indegene Omni Leaders have joint culture/accountabilities" },
  { title: "Socialize best practices from biopharma + Indegene integration within CTG group" },
  { title: "Strengthen Media capability: achieve $20Mn media-linked revenue", metrics: "$10Mn exit run rate in Q4", tags: "Media" },
  { title: "Scale media revenues to ≥$12Mn topline", metrics: "Pipelines reaching 50M in 3 years", tags: "Media" },
  { title: "Land ≥1 media large deal with TCV ≥$5Mn", tags: "Media" },
  { title: "Develop comprehensive plan to scale media business", metrics: "Integrated deal archetypes and actionable game plan", tags: "Media" },
  { title: "Demonstrate value arch elevation", metrics: "2 media leaders, process maturity, 2 thought leadership collaterals", tags: "Media" },
];

const BP_MBS: Mb[] = [
  { code: "MB1", name: "GTM & Cross-Sell", rag: "AMBER", tactics: [
    { name: "Finalize and operationalize the integrated BioPharm GTM story across all client-facing teams", outcome: "Integrated BioPharm story finalized and activated across GTM accounts",
      exec: [["ON_TRACK", "Integrated BioPharm story finalized and presented at the Annual Meet; elevator pitch now live across teams"]],
      out: [["NONE", "Joint narrative finalized, presented at AGM, and activated across GTM accounts"]] },
    { name: "Drive execution through structured planning and tracking across ~18 priority accounts", outcome: "GTM execution and tracking mechanism operational across priority accounts",
      exec: [["ON_TRACK", "Portfolio-level account meetings completed; 18 board accounts actively tracked with account planning resumed"], ["ON_TRACK", "~16 accounts completed through opportunity mapping, handshake, or account planning sessions"], ["ON_TRACK", "Justin actively leading GTM, marketing, integrated story, and large deal construct initiatives"], ["WATCH", "GTM momentum building across J&J, Amgen, Lilly Greenhouse, Bayer, and other accounts; broader execution acceleration still required"]],
      out: [["NONE", "18 board accounts identified; ~16 accounts covered through planning / handshake sessions"]] },
    { name: "Accelerate rollout of joint marketing assets; two assets live with additional assets under development", outcome: "Joint marketing activation underway with first asset live",
      exec: [["ON_TRACK", "Two joint marketing assets live; additional assets under development"]], out: [["NONE", "First joint marketing asset live"]] },
    { name: "Activate brand-facing teams for integrated client engagement and outreach", outcome: "Brand-facing teams activated for joint client engagement" },
    { name: "Strengthen governance across 39 cross-sell/upsell opportunities through better tagging and stage hygiene", outcome: "Cross-sell / upsell pipeline tracked as a separate line item",
      exec: [["ON_TRACK", "Cross-sell / upsell pipeline stands at 43 opportunities worth $9.49Mn"], ["ON_TRACK", "Key active pursuits underway across Summit, J&J, Lilly Greenhouse, Amgen, Bayer, and other strategic accounts"]],
      out: [["NONE", "Cross-sell / upsell pipeline at 43 opportunities valued at $9.49Mn"], ["NONE", "Integrated pipeline tracking and governance operational"]] },
    { name: "Closely track conversion momentum across Summit ($1.3M closed), J&J, Lilly Greenhouse, Amgen, and Bayer opportunities", outcome: "Conversion tracking active across Summit, J&J, Lilly, Amgen, Bayer, and other priority accounts",
      exec: [["ON_TRACK", "Summit opportunity ($1.3Mn) successfully closed, with additional precision media opportunities under discussion"]], out: [["NONE", "Summit deal closed: $1.3Mn ACV signed"]] },
    { name: "Continue monitoring progress across 16+ activated accounts with 44 identified opportunities (9 currently active)", outcome: "Governance cadence operational for tracking committed accounts and opportunities",
      exec: [["ON_TRACK", "All portfolio-level account meetings completed, enabling top-down alignment across priority accounts"], ["ON_TRACK", "Account planning progressing well with ~16 accounts covered and planning underway for the next set of accounts"], ["ON_TRACK", "Joint account planning and engagement active across Alcon, Axsome, AZ, Bayer, Eisai, Ipsen, J&J, Lilly, Novartis, Pfizer, Novo Nordisk, GSK, Gilead, and other priority accounts"], ["ON_TRACK", "Multiple opportunity areas identified across accounts, including ongoing discussions in precision media and analytics-led engagements"]] },
    { name: "Expand Project Catalyst and enablement initiatives for stronger BioPharm engagement", outcome: "Project Catalyst activation underway for BP team enablement", out: [["NONE", "Project Catalyst and BP enablement initiatives underway"]] },
    { name: "Accelerate Justin-led GTM momentum across marketing, integrated story, and opportunity development", outcome: "Justin driving GTM momentum through joint pitches and portfolio alignment",
      exec: [["WATCH", "Qualified opportunity momentum improving; stronger execution push required to accelerate closures"], ["ON_TRACK", "Justin-led portfolio sessions completed; farmed opportunities now being documented and prioritized for execution"]],
      out: [["NONE", "Justin driving GTM execution across key initiatives"], ["NONE", "Joint pitches progressing; portfolio strategy sessions completed across priority accounts"]] },
    { name: "Build and operationalize 3 AI-led large deal archetypes across media, omni-channel, analytics, and operations", outcome: "AI-led large deal archetypes across media, omni, and operations progressing toward activation",
      exec: [["WATCH", "Three AI-led large deal archetypes defined — Omnichannel Operating Model, KOL AOR, and Precision Media — with refinement and execution planning underway"]] },
  ] },
  { code: "MB2", name: "Reducing Forecast Variance", rag: "AMBER", tactics: [
    { name: "Template alignment as per Indegene standards", outcome: "Template alignment completed as per Indegene standards",
      exec: [["WATCH", "Finance tracking is active; Girish G and team strengthening financial tracking and expanding variable coverage."]],
      out: [["NONE", "Indegene finance templates shared with BioPharm"], ["NONE", "Alignment in progress, not fully signed off."]] },
    { name: "Tracking conversion of multi year deals", outcome: "Forecast variance reduced to <= +/-5% QoQ",
      exec: [["WATCH", "Forecasting processes are being tightened with Finance, Operations, and Steve Carickhoff"]], out: [["NONE", "Q1 closed ahead of target and Q2 forecast ahead of earlier forecast"]] },
    { name: "Tracking and reporting monthly progress on Long-duration contract conversions", outcome: "Tracking and reporting monthly progress on Long-duration contract conversions" },
  ] },
  { code: "MB3", name: "Milestone Revenue Accrual Tracking", rag: "AMBER", tactics: [
    { name: "Decision on scientific method finalization (auditor approved) for revenue accrual measurements between Milestones", outcome: "100% alignment on scientific revenue accrual process between BioPharm and Indegene financial auditors",
      exec: [["WATCH", "The team is working on implementing a more scientific accrual methodology defined upfront"], ["WATCH", "Finance has enhanced tracking of additional direct / indirect variables and is improving accrual-based revenue methodology."]],
      out: [["NONE", "Alignment still work-in-progress"]] },
    { name: "Tracking of revenue accrual using the new method", outcome: "Better revenue predictability (target: improvement by 10-20%)", out: [["NONE", "Quantified predictability uplift not yet reported."]] },
    { name: "Unified revenue tracking mechanism operational for auditor compliance", outcome: "Unified revenue tracking mechanism operational for auditor compliance", out: [["NONE", "Unified revenue dashboard operational at exec level; auditor-ready confirmation not yet stated."]] },
  ] },
  { code: "MB4", name: "Global Delivery Model (GDM) & Margin Expansion", rag: "AMBER", tactics: [
    { name: "Replicate early transitions (e.g., Ideaya) to more accounts this quarter.", outcome: "GDM deployed across more priority accounts",
      exec: [["ON_TRACK", "Global Delivery Model has officially launched with all key stakeholders onboard"], ["ON_TRACK", "At Deciphera, roles are being identified for GDM"]],
      out: [["NONE", "The first project under GDM, Ideaya DSE Website, is reported delivered; scaled to TCV of approximately $375K, with expected savings around 30%, translating to $112K."], ["NONE", "Deciphera and Danyelza vendor transition are in progress as a $250K opportunity"]] },
    { name: "Track offshoring % monthly and link to GM uplift (needs deepdive for baseline).", outcome: "Quantified GM uplift linked to offshoring % (baseline deepdive required) and reported regularly",
      exec: [["RISK", "Offshoring % & delivery KPIs not yet surfaced"]], out: [["NONE", "Offshoring % tracking initiated; GM uplift baseline deep-dive not yet completed"]] },
    { name: "Target model mix FY26: 30/70 – 30% roles offshore, 70% onshore. Currently approx 100% onshore.", outcome: "Achieve 30/70 offshore/onshore model mix by end of FY26",
      exec: [["ON_TRACK", "Ideaya model is fully operational, with 12 roles deployed under GDM for the Ideaya DSE website versus Q1 target of 4 roles"]] },
    { name: "Add quality guardrails (FTR, on-time, SLA) to reassure accounts. (Offshore related quality challenges)", outcome: "Quality guardrails (FTR, on-time, SLA) defined, reported, and tracked",
      exec: [["RISK", "Quality guardrails need to be defined and reported - other buckets of GDM to be considered as priority"]] },
  ] },
  { code: "MB5", name: "Data & Tech Convergence (Invisage-led)", rag: "AMBER", tactics: [
    { name: "Build Master HCP coverage", outcome: "Master HCP coverage map completed (BioPharm 3.5M + Indegene 2M records mapped and unified)",
      exec: [["ON_TRACK", "HCP data mapping is complete, establishing approximately 3.6Mn unique HCPs and 500Mn interactions data."]], out: [["NONE", "The HCP mapping component completed"]] },
    { name: "Lock top-3 integrated use-cases (Invisage audience + Tandem media -> unified reporting).", outcome: "Top-3 integrated use cases signed off and client-grade demos attached",
      exec: [["WATCH", "Tech workstream plan is finalized and approved"], ["NONE", "No progress reported yet on Tandem + Invisage integration"]], out: [["NONE", "Integrated use cases identified (omni operating model, precision media, KOL AOR)"]] },
    { name: "Harmonize reporting into client-visible dashboards", outcome: "Unified client-visible reporting dashboard live", exec: [["RISK", "No update yet on Unified client-visible dashboard"]] },
    { name: "Explore Komodo data integration saving opportunities", outcome: "Realize quantified synergistic revenue for Komodo data integration",
      exec: [["ON_TRACK", "Data workstream is working on integrating datasets, and first-level results have been published."]], out: [["NONE", "Next wave of data synergies is expected from consolidation of Symphony and Komodo datasets, with ~$300K–$400K in potential savings."]] },
  ] },
  { code: "MB6", name: "Synergy Realization (Cost + Revenue)", rag: "GREEN", tactics: [
    { name: "Track cost synergy line-items (TSA, Redi, PAVE, vendor transfers) with realized/plan/variance.", outcome: "$1.2M cost synergy target realized at line-item level (TSA, Redi, PAVE, vendor transfers)",
      exec: [["ON_TRACK", "Cost synergy is progressing well, Cost items referenced and progressing."], ["ON_TRACK", "Cost synergy targets for Pave, Redi, GenAi, TSA and Vendor transfers on target."], ["WATCH", "Additional cost savings identified in other data sets (Komodo and Symphony)"]],
      out: [["NONE", "$1.08Mn cost synergy has been realized against the $1.2Mn target."], ["NONE", "Reported synergy components are $327K Pfizer PAVE, $250K Redi Data, $241K Finance, $120K TSA, Additional $112K realized through Collaborative execution, and $34.6K through Unified GenAI Video Platform."]] },
    { name: "Govern against manual-flight triggers: <90% revenue, <60% cost synergies, high attrition.", outcome: "Manual-flight triggers monitored", out: [["NONE", "No breach status is reported for manual-flight triggers such as revenue below 90%, cost synergies below 60%, or high attrition."]] },
    { name: "Achieve vendor contract savings target of 30%", outcome: "30% saving on vendor contract transfers achieved", exec: [["ON_TRACK", "All critical manual triggers under control"]] },
  ] },
  { code: "MB7", name: "People, HR & Leadership Readiness", rag: "GREEN", tactics: [
    { name: "Maintain key talent retention (>=target; 100% cited for critical roles to date).", outcome: "Zero critical attrition; key talent retained across all critical roles",
      exec: [["ON_TRACK", "Critical talent retention is 100%."]], out: [["NONE", "Key talent retention is positive: critical/key employee retention is reported at 100% against a target of 80%."]] },
    { name: "Cross-training of the talent aligned to omni/media/data use-cases.", outcome: "Cross-training % tracked and reported against omni/media/data use-cases" },
    { name: "Establish N-2 and N-1 readiness per leadership seat; succession depth to be tracked across all three levels", outcome: "N-2 and N-1 readiness dashboard published and tracking succession depth",
      exec: [["WATCH", "N-1 mapping is done and tracking is in progress for identifying long-term players in BioPharm on a development track."]], out: [["NONE", "Progress made on N-1 Leadership Readiness however dashboard publication yet to happen."]] },
    { name: "Achieving Indegene - Biopharm cultural alignment through defined metrices", outcome: "Indegene-BP cultural alignment tracking metrices defined. Workshops completed and reporting completed on cultural alignment completion" },
    { name: "Implement 9-box model for identifying long-term BioPharm leaders", outcome: "9-box model executed; long-term BioPharm leaders identified and on development track", out: [["NONE", "No progress reported on 9-box model"]] },
    { name: "Publish HR/Finance/TSA Integration Playbook.", outcome: "HR/Finance/TSA Integration Playbook formalized as institutional M&A playbook",
      exec: [["WATCH", "Recruitment, LMS, and Goal Setting & Performance Management demos are completed."], ["WATCH", "OKR Module sessions is to be scheduled;"]], out: [["NONE", "No progress reported on HR/Finance/TSA Integration Playbook"]] },
  ] },
  { code: "MB8", name: "Media - Becoming one unified formidable media player (by Sep 26)", rag: "AMBER", tactics: [
    { name: "Build 2026 media execution plan, includes expanding HCP + DTC capabilities across new channels", outcome: "A single, approved 2026 media execution plan drives scaled HCP and DTC activation across new channels for priority clients.",
      exec: [["NONE", "Media reverse merger is complete, progress tracking toward a ~$7M target"]], out: [["NONE", "Reverse merger completed"], ["NONE", "Programmatic media transition to India initiated for Ideaya account"]] },
    { name: "Unified value proposition (cross-leveraging)", outcome: "Integrated Media + Omni + Data + AI value proposition, resulting in larger, bundled deals.",
      exec: [["NONE", "A joint media integration plan and shared vision are established and approved."], ["NONE", "First integrated pitch being prepared and integration discussions ongoing with Uday Ghorpade on patient targeting tool."]] },
    { name: "Unified GTM", outcome: "One coordinated GTM motion with shared ownership, pipeline visibility, and conversion accountability.",
      exec: [["NONE", "Growth and GTM discussions are ongoing with Uday around patient targeting tools"]], out: [["NONE", "GTM progressing well. Significant progress on integrated pitch creation"]] },
    { name: "Unified operating model", outcome: "One integrated operating model, improving speed, predictability, and margin", exec: [["NONE", "Unified operating model yet to be finalized"]] },
    { name: "Unified joint pitches & win", outcome: "Joint pitches consistently converting into repeatable, large integrated wins.",
      exec: [["NONE", "Joint Indegene + Addressable Health pitch is in development; first integrated pitch is being prepared; progress is being tracked toward an approximately $7Mn target"]] },
    { name: "Launch AI-Powered Innovative Product Offering", outcome: "AI-powered offerings productized, sold, and adopted by clients as a differentiated driver." },
  ] },
  { code: "MB9", name: "Capability", rag: "GREEN", tactics: [
    { name: "Addressable Health capability integration - aligning BioPharm's Addressable Health with Indegene's omni framework", outcome: "Addressable Health is fully integrated into Indegene omnichannel stack (no siloed tracks)",
      exec: [["NONE", "IDEAYA integration project successfully went live"], ["NONE", "The project website for IDEAYA and Addressable Health launched, press release planned, and the disease state centre went live."], ["NONE", "Multiple rounds of training with the Addressable Health team completed."], ["NONE", "Recommended operating model in development, stakeholder feedback received, and publication planned within the next few weeks."]],
      out: [["NONE", "Addressable Health Team actively participating in joint pitches, GTM planning, and media-led opportunities to focus on media growth"]] },
    { name: "Tandem unification", outcome: "Integrated BioPharm and Indegene Tandem capabilities into a unified stack",
      exec: [["NONE", "Structured 36-90 day plan for Tandem and Invisage integration is live"], ["NONE", "Tandem Team to deliver strategic journey-planning aspects for Vertex MarTech capabilities"]] },
    { name: "Integration of Indegene's AI capabilities into Biopharm & AH", outcome: "AI wrapper applied to BioPharm capabilities as part of Indegene AI integration roadmap",
      exec: [["NONE", "InfuseAI series has started; Content SuperApp and Insight Genie sessions are complete, and AI video capability is consolidated."], ["NONE", "Immersive Studio unlocked $34K savings on Synthesia subscription and provided BioPharm a dedicated workspace."]],
      out: [["NONE", "InfuseAI track actively executed: Immersive Studio, Insight Genie, Content SuperApp sessions completed; GenAI video platform consolidated with cost savings."]] },
    { name: "Build differentiated Full-Service Digital Agency Capabilities", outcome: "Indegene's positioning as a full-service digital agency partner.",
      exec: [["NONE", "Web CoE for Ideaya under discussion, GEO onboarding being explored (Will be part of capabilities)"]] },
  ] },
];

const BP_STRATEGY_INSIGHTS: { title: string; description: string }[] = [
  { title: "Joint GTM and cross-sell motion is active, with meaningful early pipeline", description: "Joint narrative is finalized and activated; ~16 of 18 board accounts are covered. Cross-sell / upsell pipeline stands at 43 opportunities worth $9.49Mn, with $1.3Mn ACV Summit deal closed." },
  { title: "Forecasting and revenue governance are improving, but full sign-off is pending", description: "Finance templates are shared, Q1 closed ahead of target, and Q2 forecast improved. However, alignment is still not fully signed off and quantified predictability uplift is not yet reported." },
  { title: "Enterprise deal and delivery model expansion has early proof, but margin baseline is incomplete", description: "Ideaya DSE Website under GDM delivered with ~$375K TCV and expected ~$112K savings. Offshoring tracking has started, but gross-margin uplift baseline is still pending." },
  { title: "Media and data-tech convergence are progressing, with savings potential identified", description: "HCP mapping is complete and integrated use cases are identified. Symphony and Komodo consolidation may unlock $300K–$400K savings, but realized savings are not yet confirmed." },
  { title: "Cost synergy realization is strong", description: "$1.08Mn cost synergy realized against $1.2Mn target, with no breach reported on manual-flight triggers." },
  { title: "People retention is strong, but leadership and integration playbooks need completion", description: "Critical/key employee retention is 100% against 80% target, and N-1 leadership readiness has progressed. However, dashboard publication, 9-box model, and HR/Finance/TSA playbook are still pending or show no progress." },
  { title: "Unified media-player ambition has structural progress, but scale targets remain unproven", description: "Reverse merger is complete, Ideaya programmatic media transition to India has started, and integrated pitch creation is progressing. Revenue progress against media-linked, topline, and large-deal targets is not yet reported." },
];

async function main() {
  const org = await prisma.organization.upsert({ where: { slug: "indegene" }, update: {}, create: { name: "Indegene", slug: "indegene" } });

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash },
    create: { orgId: org.id, email: ADMIN_EMAIL, name: "GovEx Admin", passwordHash, authProvider: "credentials" },
  });
  await prisma.membership.upsert({
    where: { userId_orgId: { userId: admin.id, orgId: org.id } },
    update: { role: "SYSTEM_ADMIN" }, create: { userId: admin.id, orgId: org.id, role: "SYSTEM_ADMIN" },
  });

  await prisma.domain.deleteMany({ where: { orgId: org.id } });
  const domainMap: Record<string, string> = {};
  for (let i = 0; i < DOMAINS.length; i++) {
    const d = await prisma.domain.create({ data: { orgId: org.id, name: DOMAINS[i], slug: slugify(DOMAINS[i]), displayOrder: i } });
    domainMap[DOMAINS[i]] = d.id;
  }

  // ── BioPharm & Media (rich, sample-derived) ──────────────────────────────
  await prisma.tracker.create({
    data: {
      orgId: org.id, domainId: domainMap["BioPharm & Media"],
      name: "BioPharm & Media Integration",
      description: "Post-merger integration of BioPharm Communications into Indegene across seven governance workstreams.",
      strategyObjective: "Protect the base, unlock synergies, build a combined AI-first omnichannel + media capability, and integrate people/operating model.",
      okrObjective: "Combined CY'26 revenue vs plan; total cost synergies vs target; critical-talent retention; roles transitioned to GDM; cross-sell ACV.",
      lifecycleStatus: "ACTIVE", ragStatus: "AMBER", signalStatus: "WATCH",
      ownerName: "Vivek Ghai", targetPeriod: "FY26", currency: "USD",
      budget: 53.0, spend: 9.22, forecast: 9.52, overallConfidence: 70,
      createdBy: admin.email, updatedBy: admin.email,
      strategyGoals: { create: BP_GOALS.map((text, order) => ({ text, order })) },
      okrs: { create: BP_OKRS.map((o, order) => ({ title: o.title, metrics: o.metrics ?? null, tags: o.tags ?? null, order })) },
      strategyInsights: { create: BP_STRATEGY_INSIGHTS.map((s, order) => ({ title: s.title, description: s.description, order })) },
      microBattles: { create: BP_MBS.map(mbCreate) },
      stakeholders: { create: [
        { name: "Vivek Ghai", roleOnTracker: "Executive Governance", ownsWhat: "Overall integration", isPrimary: true },
        { name: "Shaswata Bhowmick", roleOnTracker: "Integration Head", ownsWhat: "Integration delivery" },
        { name: "Steve Carickhoff", roleOnTracker: "Integration Head (BioPharm)", ownsWhat: "BioPharm continuity & culture" },
        { name: "Sarvesh Koyande", roleOnTracker: "Sales & GTM", ownsWhat: "Cross-sell / GTM execution" },
      ] },
      financialMetrics: { create: [
        { label: "Gross Revenue", period: "FY26", unit: "USD_M", planned: 53, actual: null, forecast: 51, confidence: 60 },
        { label: "Net Revenue", period: "FY26", unit: "USD_M", planned: 38.5, actual: null, forecast: 37, confidence: 60 },
        { label: "Cost Synergies", period: "FY26", unit: "USD_M", planned: 1.2, actual: 1.08, forecast: 1.2, confidence: 75 },
        { label: "Critical Talent Retention", period: "Q2 CY26", unit: "PCT", planned: 80, actual: 100, forecast: 100, confidence: 90 },
      ] },
      risks: { create: [
        { title: "GTM large-deal archetypes not yet delivered", severity: "High", status: "Open", confidence: 55 },
        { title: "Offshoring % & delivery KPIs not yet surfaced", severity: "Medium", status: "Open", confidence: 60 },
        { title: "Forecast variance / accrual methodology not fully signed off", severity: "Medium", status: "Open", confidence: 60 },
      ] },
      nextActions: { create: [
        { title: "Revenue Synergy OKR sign-off (Jay & Steve)", owner: "Vivek Ghai", assigneeGroup: "you", priority: "high", status: "open", dueDate: "Jan 2026" },
        { title: "Master HCP coverage (Tandem + Invisage)", assigneeGroup: "team", priority: "high", status: "in_progress", dueDate: "03/06" },
        { title: "Publish HR/Finance/TSA Integration Playbook", assigneeGroup: "team", priority: "medium", status: "open", dueDate: "—" },
      ] },
      decisionLog: { create: [
        { decision: "Run integration as a 3-in-a-box orchestration across 7 workstreams.", rationale: "Joint accountability — every workstream has an Indegene owner and a BioPharm counterpart.", decidedBy: "Integration SteerCo" },
      ] },
    },
  });

  // ── Pfizer PAVE (financial-heavy example) ────────────────────────────────
  const pave = await prisma.tracker.create({
    data: {
      orgId: org.id, domainId: domainMap["Pfizer Pave Deal"],
      name: "Pfizer PAVE Collaboration",
      description: "Multi-year performance-based commercialization collaboration: Indegene runs digital detailing for mature Pfizer brands, paid on incremental gross-margin share above an agreed baseline.",
      strategyObjective: "Prove digital detailing (PDEs via the DRE model) performs like a field force at lower cost; scale PAVE as a replicable pharma model.",
      okrObjective: "Grow portfolio share past 12%; keep revenue ahead of plan; hit target incremental amounts as margin share steps down.",
      lifecycleStatus: "ACTIVE", ragStatus: "AMBER", signalStatus: "WATCH",
      ownerName: "Vivek Ghai", targetPeriod: "CY2026", currency: "USD",
      budget: 12.0, spend: 5.1, forecast: 22.8, overallConfidence: 62,
      createdBy: admin.email, updatedBy: admin.email,
      strategyGoals: { create: [
        { text: "Make digital detailing perform like an in-person field force at lower cost", order: 0 },
        { text: "Convert Pfizer's fixed sales-force cost into variable, performance-linked spend", order: 1 },
        { text: "Validate PAVE as a replicable model for other pharma clients", order: 2 },
      ] },
      okrs: { create: [
        { title: "Grow PAVE revenue past 12% of total GovEx portfolio share", metrics: "9.3% → 12%", order: 0 },
        { title: "Keep monthly revenue ahead of plan", metrics: "$5.1M vs $4.8M (Aug)", order: 1 },
        { title: "Hit CY2026 Target Incremental Amount", metrics: "$17.17M", order: 2 },
      ] },
      strategyInsights: { create: [
        { title: "Revenue ahead of plan, but Pilot Phase is the open test", description: "Revenue has beaten plan for 3 consecutive months; Pilot Phase completion (88% vs 95%) and two data-integration sub-milestones remain the critical path to the Scale Phase.", order: 0 },
        { title: "Model economics favour early Indegene upside, tapering later", description: "89% incremental gross-margin share in CY2026 reflects Indegene carrying build/run risk; the step-down in 2027-28 reflects a maturing, more profitable program for Pfizer.", order: 1 },
      ] },
      microBattles: { create: [mbCreate({
        code: "MB1", name: "Pilot Phase delivery & data integration", rag: "AMBER",
        tactics: [
          { name: "Complete two outstanding data-integration sub-milestones", outcome: "Pilot Phase completion reaches 95% plan",
            exec: [["RISK", "Pilot Phase at 88% vs 95% plan — two data-integration sub-milestones outstanding."]], out: [["WATCH", "Pilot completion trending up but behind plan."]] },
          { name: "Stand up real-time performance dashboard for Pfizer", outcome: "Pfizer can see PDE performance in real time",
            exec: [["ON_TRACK", "Revenue ahead of plan for 3 consecutive months ($5.1M vs $4.8M in Aug)."]] },
        ],
      }, 0)] },
      stakeholders: { create: [
        { name: "Vivek Ghai", roleOnTracker: "Executive Sponsor", ownsWhat: "Overall deal governance & renewal", isPrimary: true },
        { name: "Shaswata Bhowmick", roleOnTracker: "Delivery Lead", ownsWhat: "Pilot/Scale phase delivery & data integration" },
        { name: "Caleb Hart", roleOnTracker: "Pfizer Interim PAVE Lead", ownsWhat: "Pfizer-side foundation (SOW)" },
      ] },
      financialMetrics: { create: [
        { label: "Monthly Revenue", period: "Aug CY26", unit: "USD_M", planned: 4.8, actual: 5.1, forecast: 5.3, confidence: 75 },
        { label: "Target Incremental Amount", period: "CY2026", unit: "USD_M", planned: 17.17, actual: null, forecast: 14.0, confidence: 55 },
        { label: "OpEx Floor", period: "CY2026", unit: "USD_M", planned: 12.0, actual: 12.0, forecast: 12.0, confidence: 90 },
        { label: "Gross Margin %", period: "Aug CY26", unit: "PCT", planned: 38, actual: 41, forecast: 42, confidence: 70 },
      ] },
      risks: { create: [
        { title: "Scope creep — Pfizer pilot expansion", severity: "High", status: "Open", owner: "Shaswata Bhowmick", mitigation: "JSC review of scope adds; formal change control.", confidence: 65 },
        { title: "Key stakeholder change on Pfizer side", severity: "High", status: "Mitigated", owner: "Vivek Ghai", mitigation: "Exec alignment meeting scheduled before Q4.", confidence: 70 },
      ] },
      nextActions: { create: [
        { title: "Exec alignment meeting — Pfizer stakeholder change", owner: "Vivek Ghai", assigneeGroup: "you", priority: "high", status: "open", dueDate: "Oct 7" },
        { title: "Resolve Pilot Phase data integration sub-milestones", owner: "Shaswata Bhowmick", assigneeGroup: "team", priority: "high", status: "in_progress", dueDate: "Oct 10" },
      ] },
      decisionLog: { create: [
        { decision: "Adopt gross-margin-share model (89% CY26 below target, stepping down).", rationale: "Indegene carries early build/run risk; share tapers as the program matures for Pfizer.", decidedBy: "JSC" },
      ] },
    },
  });

  // Seed one field-change so the history card is populated.
  await prisma.fieldChange.create({
    data: { trackerId: pave.id, entityType: "Tracker", entityId: pave.id, fieldKey: "signalStatus", oldValue: "ON_TRACK", newValue: "WATCH", changedBy: admin.email, source: "MANUAL", confidenceAfter: 62 },
  });

  // Stage 1 — one default ingestion key so /api/ingest is testable immediately.
  await prisma.ingestionApiKey.deleteMany({ where: { orgId: org.id } });
  const rawToken = generateIngestionToken();
  await prisma.ingestionApiKey.create({
    data: {
      orgId: org.id,
      label: "Default (seed)",
      tokenHash: hashToken(rawToken),
      tokenPreview: rawToken.slice(-4),
      createdBy: admin.email,
    },
  });

  const trackerCount = await prisma.tracker.count({ where: { orgId: org.id } });
  console.log(`Seed complete.
  Org:      ${org.name} (${org.slug})
  Admin:    ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}
  Domains:  ${DOMAINS.length}
  Trackers: ${trackerCount} (BioPharm has ${BP_MBS.length} micro-battles)

  Ingestion API token (Stage 1 — copy this now, it is not stored anywhere):
  ${rawToken}

  Test it:
  curl -X POST http://localhost:3200/api/ingest \\
    -H "Authorization: Bearer ${rawToken}" -H "Content-Type: application/json" \\
    -d '{"trackerId":"<a tracker id>","source":"EMAIL","sourceSystem":"outlook","rawText":"hello"}'`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
