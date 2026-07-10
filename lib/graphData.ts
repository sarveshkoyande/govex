import { prisma } from "@/lib/db";

export interface GraphNode {
  id: string; // prefixed, e.g. "TRACKER:xxx", "DOMAIN:xxx", "STAKEHOLDER:xxx"
  type: "TRACKER" | "DOMAIN" | "STAKEHOLDER";
  label: string;
}

export interface GraphEdge {
  source: string; // node id
  target: string; // node id
  kind: "STRUCTURAL" | "DICTIONARY" | "CONCEPTUAL";
  detail?: string; // snippet, shared-term list, or reasoning — shown on click
  confidence?: number;
}

function nodeId(type: GraphNode["type"], id: string): string {
  return `${type}:${id}`;
}

// Traces an EntityMention's polymorphic source back to the tracker/domain it
// belongs to, so the graph can draw an edge FROM that theme TO whatever it
// mentions — RAW_EVENT resolves directly (a CONTEXT_DOC's own trackerId/
// domainId), STRATEGY_INSIGHT/TACTIC_INSIGHT resolve through their owning
// tracker (a tactic insight only ever belongs to a tracker, never a
// domain-only theme, since tactics can't exist without a tracker).
async function resolveSourceOwners(
  orgId: string,
): Promise<Map<string, { type: "TRACKER" | "DOMAIN"; id: string }>> {
  const owners = new Map<string, { type: "TRACKER" | "DOMAIN"; id: string }>();

  const [rawEvents, strategyInsights, tacticInsights] = await Promise.all([
    prisma.rawIngestionEvent.findMany({
      where: { OR: [{ tracker: { orgId } }, { domain: { orgId } }] },
      select: { id: true, trackerId: true, domainId: true },
    }),
    prisma.strategyInsight.findMany({ where: { tracker: { orgId } }, select: { id: true, trackerId: true } }),
    prisma.tacticInsight.findMany({
      where: { tactic: { microBattle: { tracker: { orgId } } } },
      select: { id: true, tactic: { select: { microBattle: { select: { trackerId: true } } } } },
    }),
  ]);

  for (const e of rawEvents) {
    if (e.trackerId) owners.set(`RAW_EVENT:${e.id}`, { type: "TRACKER", id: e.trackerId });
    else if (e.domainId) owners.set(`RAW_EVENT:${e.id}`, { type: "DOMAIN", id: e.domainId });
  }
  for (const s of strategyInsights) owners.set(`STRATEGY_INSIGHT:${s.id}`, { type: "TRACKER", id: s.trackerId });
  for (const t of tacticInsights) owners.set(`TACTIC_INSIGHT:${t.id}`, { type: "TRACKER", id: t.tactic.microBattle.trackerId });

  return owners;
}

// A real ego-network, not a hub-and-spoke: the focus node, every node
// directly connected to it, AND the edges that already exist BETWEEN those
// neighbors (not just edges touching the focus). Without this second part
// every neighbor would only ever connect back to the center, never to each
// other, which is what made the first version look like a star instead of a
// web.
export function egoNetwork(nodes: GraphNode[], edges: GraphEdge[], focusId: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const directEdges = edges.filter((e) => e.source === focusId || e.target === focusId);
  const keepIds = new Set<string>([focusId]);
  for (const e of directEdges) { keepIds.add(e.source); keepIds.add(e.target); }

  const allRelevantEdges = edges.filter((e) => keepIds.has(e.source) && keepIds.has(e.target));
  return {
    nodes: nodes.filter((n) => keepIds.has(n.id)),
    edges: allRelevantEdges,
  };
}

export async function buildGraph(orgId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const [trackers, domains, stakeholders, mentions] = await Promise.all([
    prisma.tracker.findMany({ where: { orgId }, select: { id: true, name: true, domainId: true } }),
    prisma.domain.findMany({ where: { orgId }, select: { id: true, name: true } }),
    prisma.stakeholder.findMany({ where: { tracker: { orgId } }, select: { id: true, name: true, trackerId: true } }),
    prisma.entityMention.findMany({ where: { orgId } }),
  ]);

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  for (const t of trackers) nodes.set(nodeId("TRACKER", t.id), { id: nodeId("TRACKER", t.id), type: "TRACKER", label: t.name });
  for (const d of domains) nodes.set(nodeId("DOMAIN", d.id), { id: nodeId("DOMAIN", d.id), type: "DOMAIN", label: d.name });

  // Structural edges: Tracker -> Domain (already-existing relational data).
  for (const t of trackers) {
    if (t.domainId && nodes.has(nodeId("DOMAIN", t.domainId))) {
      edges.push({ source: nodeId("TRACKER", t.id), target: nodeId("DOMAIN", t.domainId), kind: "STRUCTURAL" });
    }
  }

  // Structural edges: Tracker -> Stakeholder, but ONLY for stakeholders
  // appearing on 2+ trackers — a stakeholder who only ever appears on one
  // tracker adds a leaf node with no cross-tracker information, just noise.
  const stakeholderTrackerCount = new Map<string, number>();
  for (const s of stakeholders) {
    const key = s.name.toLowerCase();
    stakeholderTrackerCount.set(key, (stakeholderTrackerCount.get(key) ?? 0) + 1);
  }
  const crossTrackerStakeholderIds = new Set(
    stakeholders.filter((s) => (stakeholderTrackerCount.get(s.name.toLowerCase()) ?? 0) >= 2).map((s) => s.id),
  );
  for (const s of stakeholders) {
    if (!crossTrackerStakeholderIds.has(s.id)) continue;
    nodes.set(nodeId("STAKEHOLDER", s.id), { id: nodeId("STAKEHOLDER", s.id), type: "STAKEHOLDER", label: s.name });
    edges.push({ source: nodeId("TRACKER", s.trackerId), target: nodeId("STAKEHOLDER", s.id), kind: "STRUCTURAL" });
  }

  // TRACKER/DOMAIN/STAKEHOLDER mentions become direct edges, same as before.
  // TERM mentions are handled entirely differently below — a bare term like
  // "AOR" is not a node in its own right (it has no content of its own to
  // click into, unlike a tracker/stakeholder), it's only meaningful as
  // evidence that TWO themes share vocabulary. So: group term mentions by
  // term, and only when 2+ DIFFERENT themes mention the same term, draw one
  // direct edge between those themes (never a term node). A theme using its
  // own glossary term with nothing else referencing it is not a connection
  // — it's just self-description, and is dropped entirely.
  const owners = await resolveSourceOwners(orgId);
  const termOwners = new Map<string, Set<string>>(); // term -> set of owner nodeIds
  const termExample = new Map<string, string>(); // term -> one example snippet

  for (const m of mentions) {
    const owner = owners.get(`${m.sourceType}:${m.sourceId}`);
    if (!owner) continue;
    const sourceNodeId = nodeId(owner.type, owner.id);

    if (m.targetType === "TERM" && m.targetTerm) {
      if (!termOwners.has(m.targetTerm)) termOwners.set(m.targetTerm, new Set());
      termOwners.get(m.targetTerm)!.add(sourceNodeId);
      if (!termExample.has(m.targetTerm)) termExample.set(m.targetTerm, m.contextSnippet);
      continue;
    }

    let targetNodeId: string | null = null;
    if (m.targetType === "TRACKER" && m.targetId) targetNodeId = nodeId("TRACKER", m.targetId);
    else if (m.targetType === "DOMAIN" && m.targetId) targetNodeId = nodeId("DOMAIN", m.targetId);
    else if (m.targetType === "STAKEHOLDER" && m.targetId) targetNodeId = nodeId("STAKEHOLDER", m.targetId);
    if (!targetNodeId || sourceNodeId === targetNodeId) continue;
    if (!nodes.has(targetNodeId)) continue; // stakeholder filtered out above, etc.

    edges.push({
      source: sourceNodeId,
      target: targetNodeId,
      kind: m.method === "CONCEPTUAL" ? "CONCEPTUAL" : "DICTIONARY",
      detail: m.method === "CONCEPTUAL" ? m.reasoning ?? undefined : m.contextSnippet,
      confidence: m.confidence,
    });
  }

  // Materialize shared-term edges: every pair of themes that mention the
  // same term gets one direct edge, combining ALL shared terms between that
  // pair into a single edge's detail rather than one edge per term.
  const pairTerms = new Map<string, string[]>(); // "a|b" (sorted) -> terms
  for (const [term, ownerSet] of termOwners) {
    const owners2 = [...ownerSet];
    if (owners2.length < 2) continue; // only this theme mentions it — not a connection
    for (let i = 0; i < owners2.length; i++) {
      for (let j = i + 1; j < owners2.length; j++) {
        const key = [owners2[i], owners2[j]].sort().join("|");
        if (!pairTerms.has(key)) pairTerms.set(key, []);
        pairTerms.get(key)!.push(term);
      }
    }
  }
  for (const [key, terms] of pairTerms) {
    const [a, b] = key.split("|");
    edges.push({
      source: a,
      target: b,
      kind: "DICTIONARY",
      detail: `Shared term${terms.length > 1 ? "s" : ""}: ${terms.join(", ")}`,
      confidence: 100,
    });
  }

  return { nodes: [...nodes.values()], edges };
}
