import { prisma } from "@/lib/db";

// The closed registry Tier-2 dictionary matching runs against — deliberately
// NOT open-ended NER. Every entry here is something we can point a mention
// at (a real Tracker/Stakeholder row) or a term explicitly worth tracking.
// This keeps extraction free of the fabrication risk open-ended NER would
// carry, per the project's grounding discipline.
export interface RegistryEntry {
  targetType: "TRACKER" | "STAKEHOLDER" | "TERM";
  targetId: string | null; // set for TRACKER/STAKEHOLDER, null for TERM
  targetTerm: string | null; // set for TERM, null otherwise
  aliases: string[]; // lowercased, longest-first is not required — caller sorts
  orgId: string;
}

// Glossary terms worth tracking as graph nodes even though they have no DB
// row of their own — hand-curated from the context docs' own glossary
// sections (the docs explicitly say "GovEx should use this to decode
// terminology in future uploads"), not invented.
const GLOSSARY_TERMS = [
  "PDE", "DRE", "Digital Rep Equivalence", "JSC", "Joint Steering Committee",
  "TSA", "Transition Services Agreement", "GDM", "Global Delivery Model",
  "3-in-a-box", "SteerCo", "AOR", "Agency of Record", "KOL AOR",
  "Peer-to-Peer360", "brand360", "Insights360",
  "NBA", "Next Best Action", "OCI", "CDP", "RWE", "Real-World Evidence",
  "HEOR", "MLR", "NEXT OCI", "Invisage", "DEMA", "CXQ",
  "NUDGE", "GAIN", "IST", "Integrated Solutions Team", "Project PRIDE",
  "Operational AI", "Evolved AI", "AI Score", "RPE", "Revenue Per Employee",
  "Capability Squad", "Role-Process Duality", "Refractive Analysis",
];

export async function buildRegistry(orgId: string): Promise<RegistryEntry[]> {
  const [trackers, stakeholders] = await Promise.all([
    prisma.tracker.findMany({ where: { orgId }, select: { id: true, name: true } }),
    prisma.stakeholder.findMany({ where: { tracker: { orgId } }, select: { id: true, name: true, email: true } }),
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

  for (const term of GLOSSARY_TERMS) {
    entries.push({ targetType: "TERM", targetId: null, targetTerm: term, aliases: [term.toLowerCase()], orgId });
  }

  return entries;
}
