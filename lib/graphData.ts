import { prisma } from "@/lib/db";
import { isSpecificTerm } from "@/lib/entityRegistry";

export type ContentNodeType = "STRATEGY_INSIGHT" | "TACTIC_INSIGHT" | "RAW_EVENT";

export interface GraphNode {
  id: string; // prefixed, e.g. "TRACKER:xxx", "DOMAIN:xxx", "STAKEHOLDER:xxx"
  type: "TRACKER" | "DOMAIN" | "STAKEHOLDER" | "UNRESOLVED_ENTITY" | ContentNodeType;
  label: string; // truncated, for on-canvas display
  detail?: string; // full untruncated text, for the click detail panel
}

export interface GraphEdge {
  source: string; // node id
  target: string; // node id
  kind: "STRUCTURAL" | "DICTIONARY" | "CONCEPTUAL" | "DERIVED" | "UNRESOLVED";
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

// Obsidian shows every note as a node, not just entities it can link into —
// a tactic that's purely internal to one theme (no cross-theme mention) is
// still real content and still belongs in the graph, fanning out from its
// tracker. Without this, the graph only ever showed the small slice of
// content that happened to reference another theme, which made the org's
// actual volume of insights/tactics/raw ingestion invisible.
function shortLabel(text: string, max = 60): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

export async function buildGraph(orgId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const [trackers, stakeholders, mentions, strategyInsights, tacticInsights, rawEventsForNodes] = await Promise.all([
    prisma.tracker.findMany({ where: { orgId }, select: { id: true, name: true, domainId: true } }),
    prisma.stakeholder.findMany({ where: { tracker: { orgId } }, select: { id: true, name: true, email: true, trackerId: true } }),
    prisma.entityMention.findMany({ where: { orgId } }),
    prisma.strategyInsight.findMany({ where: { tracker: { orgId } }, select: { id: true, title: true, trackerId: true } }),
    prisma.tacticInsight.findMany({
      where: { tactic: { microBattle: { tracker: { orgId } } } },
      select: { id: true, text: true, tactic: { select: { microBattle: { select: { trackerId: true } } } } },
    }),
    prisma.rawIngestionEvent.findMany({
      where: { OR: [{ tracker: { orgId } }, { domain: { orgId } }] },
      select: { id: true, source: true, summary: true, rawText: true, trackerId: true, domainId: true, fromAddress: true },
    }),
  ]);

  // Which raw events actually produced which insights — AiSuggestion.materializedId
  // is the bridge: it's set to the StrategyInsight/TacticInsight id created on
  // approval, and sourceEventIds (kept even post-approval) is the JSON array
  // of RawIngestionEvent ids Gemini cited as support for that claim. Without
  // this, a derived insight had no visible link back to the raw ingestion it
  // came from at all.
  const approvedSuggestions = await prisma.aiSuggestion.findMany({
    where: { tracker: { orgId }, status: "APPROVED", materializedId: { not: null } },
    select: { kind: true, materializedId: true, sourceEventIds: true },
  });

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  for (const t of trackers) nodes.set(nodeId("TRACKER", t.id), { id: nodeId("TRACKER", t.id), type: "TRACKER", label: t.name });
  // DOMAIN nodes deliberately not materialized — per explicit feedback they
  // added a layer of parent-category nodes without adding real information
  // (every tracker's domain is already obvious from its name/context). Note
  // this means a context-doc RAW_EVENT for a domain-only theme (one with no
  // Tracker row yet — Commercial AI, DAAI, Transform AI, Large Deal & GTM)
  // has no owner node to attach to and is naturally dropped by the final
  // node-existence filter below, not shown as an orphan.

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

  // Content nodes — every StrategyInsight/TacticInsight/RawIngestionEvent
  // fans out from its owning tracker (or domain, for a context-doc on a
  // domain-only theme), regardless of whether it happens to mention another
  // theme. This is the "show me everything I ingested" layer; cross-theme
  // relevance is layered on top via the mention edges below.
  for (const s of strategyInsights) {
    if (!nodes.has(nodeId("TRACKER", s.trackerId))) continue;
    nodes.set(nodeId("STRATEGY_INSIGHT", s.id), {
      id: nodeId("STRATEGY_INSIGHT", s.id),
      type: "STRATEGY_INSIGHT",
      label: shortLabel(s.title),
      detail: s.title,
    });
    edges.push({ source: nodeId("TRACKER", s.trackerId), target: nodeId("STRATEGY_INSIGHT", s.id), kind: "STRUCTURAL" });
  }
  for (const t of tacticInsights) {
    const trackerId = t.tactic.microBattle.trackerId;
    if (!nodes.has(nodeId("TRACKER", trackerId))) continue;
    nodes.set(nodeId("TACTIC_INSIGHT", t.id), {
      id: nodeId("TACTIC_INSIGHT", t.id),
      type: "TACTIC_INSIGHT",
      label: shortLabel(t.text),
      detail: t.text,
    });
    edges.push({ source: nodeId("TRACKER", trackerId), target: nodeId("TACTIC_INSIGHT", t.id), kind: "STRUCTURAL" });
  }
  // Contributor lookup — who actually submitted a raw event. Keyed by email
  // (case-insensitive), not name, since that's the reliable identifier on
  // both sides (Stakeholder.email and RawIngestionEvent.fromAddress).
  const stakeholderByEmail = new Map<string, (typeof stakeholders)[number]>();
  for (const s of stakeholders) {
    if (s.email) stakeholderByEmail.set(s.email.toLowerCase(), s);
  }

  for (const e of rawEventsForNodes) {
    const ownerNodeId = e.trackerId && nodes.has(nodeId("TRACKER", e.trackerId)) ? nodeId("TRACKER", e.trackerId) : null;
    if (!ownerNodeId) continue;
    const fullText = e.summary ?? e.rawText ?? e.source;
    nodes.set(nodeId("RAW_EVENT", e.id), {
      id: nodeId("RAW_EVENT", e.id),
      type: "RAW_EVENT",
      label: `[${e.source}] ${shortLabel(fullText, 50)}`,
      detail: `[${e.source}]\n\n${fullText}`,
    });
    edges.push({ source: ownerNodeId, target: nodeId("RAW_EVENT", e.id), kind: "STRUCTURAL" });

    // Contributor edge — a stakeholder who actually submitted this event is
    // real evidence-backed content, so this node gets added even for a
    // stakeholder who otherwise wouldn't qualify as "cross-tracker" (the bar
    // the plain structural Tracker->Stakeholder edge above uses).
    const contributor = e.fromAddress ? stakeholderByEmail.get(e.fromAddress.toLowerCase()) : undefined;
    if (contributor) {
      const stakeholderNodeId = nodeId("STAKEHOLDER", contributor.id);
      if (!nodes.has(stakeholderNodeId)) {
        nodes.set(stakeholderNodeId, { id: stakeholderNodeId, type: "STAKEHOLDER", label: contributor.name });
      }
      edges.push({ source: stakeholderNodeId, target: nodeId("RAW_EVENT", e.id), kind: "STRUCTURAL", detail: "Contributed this" });
    }
  }

  // Provenance edges: raw event -> the insight Gemini derived from it.
  for (const s of approvedSuggestions) {
    const insightType: ContentNodeType = s.kind === "STRATEGY_INSIGHT" ? "STRATEGY_INSIGHT" : "TACTIC_INSIGHT";
    const insightNodeId = nodeId(insightType, s.materializedId!);
    if (!nodes.has(insightNodeId)) continue;

    let eventIds: string[];
    try {
      eventIds = JSON.parse(s.sourceEventIds);
    } catch {
      continue;
    }
    for (const eventId of eventIds) {
      const eventNodeId = nodeId("RAW_EVENT", eventId);
      if (!nodes.has(eventNodeId)) continue;
      edges.push({ source: eventNodeId, target: insightNodeId, kind: "DERIVED", detail: "Derived by Gemini synthesis" });
    }
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
  const termOwners = new Map<string, Set<string>>(); // term -> set of owner (tracker/domain) nodeIds, for CROSS-THEME edges
  const fineTermOwners = new Map<string, Set<string>>(); // term -> set of actual content-node ids, for WITHIN-THEME edges
  const termExample = new Map<string, string>(); // term -> one example snippet

  for (const m of mentions) {
    const owner = owners.get(`${m.sourceType}:${m.sourceId}`);
    if (!owner) continue;
    const ownerNodeId = nodeId(owner.type, owner.id);

    // Prefer sourcing the edge from the actual content node (the specific
    // tactic/insight/raw event) rather than collapsing straight to its
    // owning tracker/domain — otherwise every mention edge lands on the
    // same hub node and the graph degenerates into a star, with content
    // nodes only ever pointing back to their tracker and never to what they
    // actually reference.
    const contentNodeId = nodeId(m.sourceType as GraphNode["type"], m.sourceId);
    const sourceNodeId = nodes.has(contentNodeId) ? contentNodeId : ownerNodeId;

    // UNRESOLVED — the actual "wiki-link to a page that doesn't exist yet"
    // case (see lib/entityExtraction.ts). Unlike TERM mentions (collapsed
    // into shared-vocabulary edges only), each unresolved candidate gets its
    // own ghost node — ghost because it has no DB row of its own yet, just
    // like an Obsidian unresolved link renders as a distinct, visually
    // unresolved node rather than being invisible. Keyed per tracker+term
    // (not globally) since a candidate's promotability is itself tracker-scoped.
    if (m.targetType === "UNRESOLVED" && m.targetTerm && m.trackerId) {
      const ghostNodeId = nodeId("UNRESOLVED_ENTITY", `${m.trackerId}:${m.targetTerm.toLowerCase()}`);
      if (!nodes.has(ghostNodeId)) {
        nodes.set(ghostNodeId, { id: ghostNodeId, type: "UNRESOLVED_ENTITY", label: m.targetTerm, detail: `Unresolved — ${m.reasoning ?? "candidate"}: "${m.targetTerm}"` });
      }
      edges.push({ source: sourceNodeId, target: ghostNodeId, kind: "UNRESOLVED", detail: m.contextSnippet, confidence: m.confidence });
      continue;
    }

    if (m.targetType === "TERM" && m.targetTerm) {
      if (!termOwners.has(m.targetTerm)) termOwners.set(m.targetTerm, new Set());
      termOwners.get(m.targetTerm)!.add(ownerNodeId);
      if (!fineTermOwners.has(m.targetTerm)) fineTermOwners.set(m.targetTerm, new Set());
      fineTermOwners.get(m.targetTerm)!.add(sourceNodeId);
      if (!termExample.has(m.targetTerm)) termExample.set(m.targetTerm, m.contextSnippet);
      continue;
    }

    let targetNodeId: string | null = null;
    if (m.targetType === "TRACKER" && m.targetId) targetNodeId = nodeId("TRACKER", m.targetId);
    else if (m.targetType === "DOMAIN" && m.targetId) targetNodeId = nodeId("DOMAIN", m.targetId);
    else if (m.targetType === "STAKEHOLDER" && m.targetId) targetNodeId = nodeId("STAKEHOLDER", m.targetId);
    // Compare against ownerNodeId, not sourceNodeId — a tactic mentioning
    // its OWN tracker is a self-reference and should be dropped, even
    // though sourceNodeId is now the tactic's own node id, not the
    // tracker's, so a naive sourceNodeId === targetNodeId check would never
    // catch it.
    if (!targetNodeId || ownerNodeId === targetNodeId) continue;
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
    // Universal governance jargon (SteerCo, TSA, AOR...) is real terminology
    // WITHIN a theme but every theme having a SteerCo isn't a connection
    // between them — only terms distinctive enough to be real signal
    // (isSpecificTerm) are allowed to draw a cross-theme edge.
    if (!isSpecificTerm(term)) continue;
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

  // Content nodes fanned out purely structurally to their tracker before —
  // two tactics inside the SAME theme that share a specific term (e.g. both
  // mention "Invisage") had no way to connect to each other, only each back
  // to the shared hub. This is the within-theme counterpart to the
  // cross-theme pairTerms block above, at content-node granularity rather
  // than tracker/domain granularity. Capped at 6 co-mentioning nodes per
  // term — past that a term is common enough within one theme that pairwise
  // edges would just be visual noise, not real signal.
  const finePairTerms = new Map<string, string[]>();
  for (const [term, ownerSet] of fineTermOwners) {
    if (!isSpecificTerm(term)) continue;
    const contentNodeTypes = new Set<GraphNode["type"]>(["STRATEGY_INSIGHT", "TACTIC_INSIGHT", "RAW_EVENT"]);
    const contentOwners = [...ownerSet].filter((id) => contentNodeTypes.has(nodes.get(id)?.type as GraphNode["type"]));
    if (contentOwners.length < 2 || contentOwners.length > 6) continue;
    for (let i = 0; i < contentOwners.length; i++) {
      for (let j = i + 1; j < contentOwners.length; j++) {
        const key = [contentOwners[i], contentOwners[j]].sort().join("|");
        if (!finePairTerms.has(key)) finePairTerms.set(key, []);
        finePairTerms.get(key)!.push(term);
      }
    }
  }
  for (const [key, terms] of finePairTerms) {
    const [a, b] = key.split("|");
    edges.push({
      source: a,
      target: b,
      kind: "DICTIONARY",
      detail: `Shared term${terms.length > 1 ? "s" : ""}: ${terms.join(", ")}`,
      confidence: 100,
    });
  }

  // Two different trackers are two different client engagements — even when
  // their content genuinely cross-references each other (e.g. BioPharm
  // citing the PAVE playbook), materializing that as a direct tracker<->
  // tracker edge risks visually implying a client-to-client relationship
  // that shouldn't be surfaced that bluntly. The underlying evidence still
  // shows up (via the specific content nodes/domains involved), this just
  // drops the blunt TRACKER-to-TRACKER edge itself.
  const finalEdges = edges.filter((e) => {
    const sourceType = nodes.get(e.source)?.type;
    const targetType = nodes.get(e.target)?.type;
    // Dangling edges — e.g. one pointing at a DOMAIN id, which no longer
    // has a node — must be dropped explicitly rather than left for the
    // renderer to silently choke on a missing endpoint.
    if (!sourceType || !targetType) return false;
    return !(sourceType === "TRACKER" && targetType === "TRACKER");
  });

  return { nodes: [...nodes.values()], edges: finalEdges };
}
