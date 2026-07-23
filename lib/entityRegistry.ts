import { prisma } from "@/lib/db";

// The closed registry Tier-2 dictionary matching runs against — deliberately
// NOT open-ended NER. Every entry here is something we can point a mention
// at (a real Tracker/Stakeholder row) or a term explicitly worth tracking.
// This keeps extraction free of the fabrication risk open-ended NER would
// carry, per the project's grounding discipline.
export interface RegistryEntry {
  targetType: "TRACKER" | "STAKEHOLDER" | "TERM" | "MICROBATTLE";
  targetId: string | null; // set for TRACKER/STAKEHOLDER, null for TERM
  targetTerm: string | null; // set for TERM, null otherwise
  aliases: string[]; // lowercased, longest-first is not required — caller sorts
  orgId: string;
  // "universal" = generic governance/PM jargon (SteerCo, TSA, AOR...) that
  // nearly every engagement uses — real when read within one theme, but
  // meaningless as a CROSS-theme graph edge (every theme "having a SteerCo"
  // isn't a connection). "specific" = a named program/metric distinctive
  // enough that two themes sharing it is real signal. Only "specific" terms
  // are allowed to produce shared-term edges between themes — see graphData.ts.
  scope?: "universal" | "specific";
}

// Glossary terms worth tracking as graph nodes even though they have no DB
// row of their own — hand-curated from the context docs' own glossary
// sections (the docs explicitly say "GovEx should use this to decode
// terminology in future uploads"), not invented.
const GLOSSARY_TERMS: { term: string; scope: "universal" | "specific" }[] = [
  { term: "JSC", scope: "universal" },
  { term: "Joint Steering Committee", scope: "universal" },
  { term: "TSA", scope: "universal" },
  { term: "Transition Services Agreement", scope: "universal" },
  { term: "GDM", scope: "universal" },
  { term: "Global Delivery Model", scope: "universal" },
  { term: "3-in-a-box", scope: "universal" },
  { term: "SteerCo", scope: "universal" },
  { term: "AOR", scope: "universal" },
  { term: "Agency of Record", scope: "universal" },
  { term: "IST", scope: "universal" },
  { term: "Integrated Solutions Team", scope: "universal" },
  { term: "MLR", scope: "universal" }, // Medical-Legal-Regulatory review — standard life-sciences jargon, not a distinctive program

  { term: "PDE", scope: "specific" },
  { term: "DRE", scope: "specific" },
  { term: "Digital Rep Equivalence", scope: "specific" },
  { term: "KOL AOR", scope: "specific" },
  { term: "Peer-to-Peer360", scope: "specific" },
  { term: "brand360", scope: "specific" },
  { term: "Insights360", scope: "specific" },
  { term: "NBA", scope: "specific" },
  { term: "Next Best Action", scope: "specific" },
  { term: "OCI", scope: "specific" },
  { term: "NEXT OCI", scope: "specific" },
  { term: "CDP", scope: "specific" },
  { term: "RWE", scope: "specific" },
  { term: "Real-World Evidence", scope: "specific" },
  { term: "HEOR", scope: "specific" },
  { term: "Invisage", scope: "specific" },
  { term: "DEMA", scope: "specific" },
  { term: "CXQ", scope: "specific" },
  { term: "NUDGE", scope: "specific" },
  { term: "GAIN", scope: "specific" },
  { term: "Project PRIDE", scope: "specific" },
  { term: "Operational AI", scope: "specific" },
  { term: "Evolved AI", scope: "specific" },
  { term: "AI Score", scope: "specific" },
  { term: "RPE", scope: "specific" },
  { term: "Revenue Per Employee", scope: "specific" },
  { term: "Capability Squad", scope: "specific" },
  { term: "Role-Process Duality", scope: "specific" },
  { term: "Refractive Analysis", scope: "specific" },
];

const TERM_SCOPE = new Map(GLOSSARY_TERMS.map((g) => [g.term, g.scope]));

// Used by graphData.ts to decide whether a shared term is real cross-theme
// signal ("specific") or just universal jargon every theme happens to use
// ("universal") — graphs only draw an edge for the former.
export function isSpecificTerm(term: string): boolean {
  return TERM_SCOPE.get(term) === "specific";
}

export async function buildRegistry(orgId: string): Promise<RegistryEntry[]> {
  const [trackers, stakeholders, microBattles, orgTerms] = await Promise.all([
    prisma.tracker.findMany({ where: { orgId }, select: { id: true, name: true } }),
    prisma.stakeholder.findMany({ where: { tracker: { orgId } }, select: { id: true, name: true, email: true } }),
    // PROJECT-type unresolved-entity candidates promote into a MicroBattle
    // (see lib/entityExtraction.ts) — registered here so a promoted project
    // (a) stops being offered again as an unresolved candidate, and (b) gets
    // recognized by future dictionary-tier extraction the same as any other
    // named entity.
    prisma.microBattle.findMany({ where: { tracker: { orgId } }, select: { id: true, name: true, trackerId: true } }),
    // OTHER-type candidates promote into an org-authored term instead —
    // the runtime-growable counterpart to the hand-curated GLOSSARY_TERMS
    // list below, which ships with the app and can't grow at runtime.
    prisma.orgTerm.findMany({ where: { orgId }, select: { term: true, scope: true } }),
  ]);

  const entries: RegistryEntry[] = [];

  for (const t of trackers) {
    // Cheap alias generation: the full name, plus one distinctive short word
    // out of it — e.g. "PAVE" out of "Pfizer PAVE Collaboration". Prefer an
    // ALL-CAPS acronym-looking word (PAVE, DAAI) over just "the first word",
    // since the first word is often a generic company/client name ("Pfizer")
    // that would false-positive-match every unrelated mention of that word.
    const aliases = [t.name.toLowerCase()];
    const words = t.name.split(/\s+/).filter((w) => /^[A-Za-z]+$/.test(w));
    const acronymWord = words.find((w) => w.length >= 3 && w === w.toUpperCase());
    const distinctiveWord = acronymWord ?? words.find((w) => w.length >= 4);
    if (distinctiveWord) aliases.push(distinctiveWord.toLowerCase());
    entries.push({ targetType: "TRACKER", targetId: t.id, targetTerm: null, aliases, orgId });
  }

  for (const s of stakeholders) {
    const aliases = [s.name.toLowerCase()];
    if (s.email) aliases.push(s.email.toLowerCase());
    entries.push({ targetType: "STAKEHOLDER", targetId: s.id, targetTerm: null, aliases, orgId });
  }

  for (const { term, scope } of GLOSSARY_TERMS) {
    entries.push({ targetType: "TERM", targetId: null, targetTerm: term, aliases: [term.toLowerCase()], orgId, scope });
  }

  for (const t of orgTerms) {
    entries.push({ targetType: "TERM", targetId: null, targetTerm: t.term, aliases: [t.term.toLowerCase()], orgId, scope: t.scope === "specific" ? "specific" : "universal" });
  }

  for (const mb of microBattles) {
    entries.push({ targetType: "MICROBATTLE", targetId: mb.id, targetTerm: null, aliases: [mb.name.toLowerCase()], orgId });
  }

  return entries;
}
