"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import type { GraphNode, GraphEdge } from "@/lib/graphData";

// Bright, high-saturation, mutually distinguishable — deliberately no grey
// or muted tones, so every node type reads clearly against the dark canvas.
const NODE_COLOR: Record<GraphNode["type"], string> = {
  TRACKER: "#3b82f6", // bright blue
  DOMAIN: "#2dd4bf", // bright teal
  STAKEHOLDER: "#fb923c", // bright orange
  STRATEGY_INSIGHT: "#d946ef", // bright magenta
  TACTIC_INSIGHT: "#facc15", // bright yellow
  RAW_EVENT: "#22d3ee", // bright cyan
  // Deliberately muted/grey, unlike every other (bright, confirmed) node
  // type — this is a candidate with no DB row yet, not a confirmed entity,
  // and should read as visually "unresolved" at a glance, the same way
  // Obsidian renders a link to a page that doesn't exist.
  UNRESOLVED_ENTITY: "#94a3b8",
};
const NODE_RADIUS: Record<GraphNode["type"], number> = {
  TRACKER: 15,
  DOMAIN: 11,
  STAKEHOLDER: 8.5,
  STRATEGY_INSIGHT: 6,
  TACTIC_INSIGHT: 4.5,
  RAW_EVENT: 5,
  UNRESOLVED_ENTITY: 7,
};
const NODE_TYPE_LABEL: Record<GraphNode["type"], string> = {
  TRACKER: "Tracker",
  DOMAIN: "Domain",
  STAKEHOLDER: "Stakeholder",
  STRATEGY_INSIGHT: "Strategy insight",
  TACTIC_INSIGHT: "Tactic insight",
  RAW_EVENT: "Raw ingestion",
  UNRESOLVED_ENTITY: "Unresolved entity",
};
// Sigma's default edge renderer draws plain lines — no native dash-pattern
// support without a custom edge program, so kind is differentiated by
// color + width instead of the force-graph version's dash patterns.
const EDGE_STYLE: Record<GraphEdge["kind"], { color: string; width: number }> = {
  STRUCTURAL: { color: "rgba(59, 130, 246, 0.55)", width: 1.4 },
  DICTIONARY: { color: "rgba(45, 212, 191, 0.7)", width: 1.1 },
  CONCEPTUAL: { color: "rgba(251, 146, 60, 0.7)", width: 1.1 },
  DERIVED: { color: "rgba(217, 70, 239, 0.7)", width: 1.1 },
  UNRESOLVED: { color: "rgba(148, 163, 184, 0.5)", width: 0.9 },
};
const EDGE_KIND_LABEL: Record<GraphEdge["kind"], string> = {
  STRUCTURAL: "Structural relationship",
  DICTIONARY: "Named mention",
  DERIVED: "Derived from raw ingestion",
  CONCEPTUAL: "Conceptual link",
  UNRESOLVED: "Unresolved mention",
};

type Selection = { type: "node"; node: GraphNode } | { type: "edge"; edge: GraphEdge } | null;

function nodeHref(node: GraphNode): string | null {
  const [type, id] = node.id.split(":");
  if (type === "TRACKER") return `/trackers/${id}`;
  return null;
}

export default function KnowledgeGraph({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendererRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 900, height: 520 });
  const [visibleKinds, setVisibleKinds] = useState<Set<GraphEdge["kind"]>>(new Set(["STRUCTURAL", "DICTIONARY", "CONCEPTUAL", "DERIVED", "UNRESOLVED"]));
  const [showContent, setShowContent] = useState(true);
  const [selection, setSelection] = useState<Selection>(null);

  const contentTypes = useMemo(() => new Set<GraphNode["type"]>(["STRATEGY_INSIGHT", "TACTIC_INSIGHT", "RAW_EVENT"]), []);
  const filteredEdges = useMemo(() => {
    const byKind = edges.filter((e) => visibleKinds.has(e.kind));
    if (showContent) return byKind;
    const contentNodeIds = new Set(nodes.filter((n) => contentTypes.has(n.type)).map((n) => n.id));
    return byKind.filter((e) => !contentNodeIds.has(e.source) && !contentNodeIds.has(e.target));
  }, [edges, visibleKinds, showContent, nodes, contentTypes]);
  const connectedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of filteredEdges) { ids.add(e.source); ids.add(e.target); }
    return ids;
  }, [filteredEdges]);
  const filteredNodes = useMemo(() => nodes.filter((n) => connectedIds.has(n.id)), [nodes, connectedIds]);
  const nodeById = useMemo(() => new Map(filteredNodes.map((n) => [n.id, n])), [filteredNodes]);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const observer = new ResizeObserver(() => setSize({ width: el.clientWidth, height: 520 }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!canvasHostRef.current) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderer: any = null;

    (async () => {
      const [{ default: Graph }, { default: Sigma }, forceAtlas2Module] = await Promise.all([
        import("graphology"),
        import("sigma"),
        import("graphology-layout-forceatlas2"),
      ]);
      if (cancelled || !canvasHostRef.current) return;
      const forceAtlas2 = forceAtlas2Module.default;

      // multi: true — GovEx's own edge data can legitimately contain more
      // than one edge between the same pair of nodes (e.g. two separate
      // DICTIONARY mentions), which a plain (non-multi) graphology graph
      // would silently collapse.
      const graph = new Graph({ multi: true, type: "mixed" });

      for (const n of filteredNodes) {
        // Spread initial positions out (not all clustered at origin) — FA2
        // converges much faster, and looks less like a starburst exploding
        // outward, from a wider random start.
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * 400;
        graph.addNode(n.id, {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          size: NODE_RADIUS[n.type],
          color: NODE_COLOR[n.type],
          label: n.label,
        });
      }
      for (const e of filteredEdges) {
        if (!graph.hasNode(e.source) || !graph.hasNode(e.target)) continue;
        graph.addEdge(e.source, e.target, {
          size: EDGE_STYLE[e.kind].width,
          color: EDGE_STYLE[e.kind].color,
          govexKind: e.kind,
          govexDetail: e.detail,
          govexConfidence: e.confidence,
        });
      }

      // Hover-only labels — nothing is drawn on top of a node until you
      // mouse over it (or select it), keeping the canvas clean instead of
      // cluttered with always-on text. Read via closure over a mutable ref
      // updated by the enterNode/leaveNode handlers below, since a Sigma
      // reducer needs to stay in sync with hover state without re-creating
      // the whole renderer on every hover (a React state dependency here
      // would do exactly that).
      const hoveredRef = { current: null as string | null };
      renderer = new Sigma(graph, canvasHostRef.current, {
        renderLabels: true,
        labelColor: { color: "#e2e8f0" },
        labelFont: "Inter, system-ui, sans-serif",
        labelWeight: "600",
        defaultNodeColor: "#94a3b8",
        defaultEdgeColor: "rgba(148, 163, 184, 0.4)",
        minCameraRatio: 0.03,
        maxCameraRatio: 12,
        nodeReducer: (node: string, data: Record<string, unknown>) => (node === hoveredRef.current ? data : { ...data, label: null }),
      });

      renderer.on("enterNode", ({ node }: { node: string }) => {
        hoveredRef.current = node;
        renderer?.refresh();
      });
      renderer.on("leaveNode", () => {
        hoveredRef.current = null;
        renderer?.refresh();
      });
      renderer.on("clickNode", ({ node }: { node: string }) => {
        const n = nodeById.get(node);
        if (n) setSelection({ type: "node", node: n });
      });
      renderer.on("clickEdge", ({ edge }: { edge: string }) => {
        const attrs = graph.getEdgeAttributes(edge);
        const [source, target] = graph.extremities(edge);
        setSelection({
          type: "edge",
          edge: { source, target, kind: attrs.govexKind, detail: attrs.govexDetail, confidence: attrs.govexConfidence },
        });
      });
      renderer.on("clickStage", () => setSelection(null));

      rendererRef.current = renderer;

      // Animated, non-blocking layout — small batches of FA2 iterations
      // yielded to the browser via requestAnimationFrame between each, so
      // (a) the tab never freezes waiting for physics to finish, and (b)
      // nodes visibly settle into place instead of just popping into their
      // final position, matching the "alive" feel a continuous force
      // simulation gives.
      if (graph.order > 0) {
        const settings = { gravity: 1, scalingRatio: 10, strongGravityMode: true, slowDown: 2, barnesHutOptimize: graph.order > 200 };
        const totalIterations = 100;
        const batchSize = 3;
        for (let done = 0; done < totalIterations; done += batchSize) {
          if (cancelled) return;
          forceAtlas2.assign(graph, { iterations: batchSize, settings });
          renderer.refresh();
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }
    })();

    return () => {
      cancelled = true;
      renderer?.kill();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNodes, filteredEdges]);

  useEffect(() => {
    rendererRef.current?.resize();
  }, [size]);

  function toggleKind(kind: GraphEdge["kind"]) {
    setSelection(null);
    setVisibleKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind); else next.add(kind);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
        {(["STRUCTURAL", "DICTIONARY", "CONCEPTUAL", "DERIVED", "UNRESOLVED"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => toggleKind(kind)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-opacity",
              visibleKinds.has(kind) ? "opacity-100" : "opacity-35",
            )}
            style={{ borderColor: EDGE_STYLE[kind].color, color: EDGE_STYLE[kind].color }}
          >
            <span className="h-0.5 w-4" style={{ background: EDGE_STYLE[kind].color }} />
            {EDGE_KIND_LABEL[kind]}
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setSelection(null); setShowContent((v) => !v); }}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition-opacity",
            showContent ? "opacity-100" : "opacity-35",
          )}
          style={{ borderColor: NODE_COLOR.TACTIC_INSIGHT, color: NODE_COLOR.TACTIC_INSIGHT }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: NODE_COLOR.TACTIC_INSIGHT }} />
          Insights, tactics &amp; raw ingestion
        </button>
        <span className="ml-auto text-[10px] text-muted-foreground">{filteredNodes.length} connected · {filteredEdges.length} links</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_240px]">
        <div ref={containerRef} className="overflow-hidden rounded-xl border border-border bg-[#0b1220]">
          <div ref={canvasHostRef} style={{ width: size.width, height: size.height }} />
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          {!selection && <p className="text-[11px] text-muted-foreground">Drag to explore. Click a node or line for detail.</p>}
          {selection?.type === "node" && (
            <>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{NODE_TYPE_LABEL[selection.node.type]}</p>
              <p className="whitespace-pre-wrap text-sm font-bold leading-snug text-foreground">{selection.node.detail ?? selection.node.label}</p>
              {nodeHref(selection.node) && (
                <Link href={nodeHref(selection.node)!} className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                  Open tracker <ArrowUpRight size={11} />
                </Link>
              )}
            </>
          )}
          {selection?.type === "edge" && (
            <>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: EDGE_STYLE[selection.edge.kind].color }}>
                {EDGE_KIND_LABEL[selection.edge.kind]}
              </p>
              <p className="text-[11px] font-semibold leading-snug text-foreground">
                {nodeById.get(selection.edge.source)?.label ?? selection.edge.source} ↔ {nodeById.get(selection.edge.target)?.label ?? selection.edge.target}
              </p>
              {selection.edge.detail && <p className="text-[11px] leading-relaxed text-muted-foreground">{selection.edge.detail}</p>}
              {selection.edge.confidence != null && selection.edge.kind === "CONCEPTUAL" && (
                <p className="text-[10px] text-muted-foreground">Confidence: {selection.edge.confidence}%</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
