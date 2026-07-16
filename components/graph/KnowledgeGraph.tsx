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
};
const NODE_RADIUS: Record<GraphNode["type"], number> = {
  TRACKER: 9,
  DOMAIN: 6.5,
  STAKEHOLDER: 5,
  STRATEGY_INSIGHT: 3.5,
  TACTIC_INSIGHT: 2.5,
  RAW_EVENT: 3,
};
const NODE_TYPE_LABEL: Record<GraphNode["type"], string> = {
  TRACKER: "Tracker",
  DOMAIN: "Domain",
  STAKEHOLDER: "Stakeholder",
  STRATEGY_INSIGHT: "Strategy insight",
  TACTIC_INSIGHT: "Tactic insight",
  RAW_EVENT: "Raw ingestion",
};
// Content nodes (insights/tactics/raw events) can run into the hundreds —
// always-on labels for those would bury the theme/domain/stakeholder labels
// that matter most at a glance. Only these three types get a persistent
// label; content-node labels only show in the click detail panel.
const ALWAYS_LABELED = new Set<GraphNode["type"]>(["TRACKER", "DOMAIN", "STAKEHOLDER"]);
const EDGE_STYLE: Record<GraphEdge["kind"], { color: string; width: number; dash?: number[] }> = {
  STRUCTURAL: { color: "rgba(59, 130, 246, 0.5)", width: 1.4 },
  DICTIONARY: { color: "rgba(45, 212, 191, 0.65)", width: 1.2, dash: [3, 3] },
  CONCEPTUAL: { color: "rgba(251, 146, 60, 0.65)", width: 1.2, dash: [1, 3] },
  DERIVED: { color: "rgba(217, 70, 239, 0.65)", width: 1.2, dash: [6, 2] },
};
const EDGE_KIND_LABEL: Record<GraphEdge["kind"], string> = {
  STRUCTURAL: "Structural relationship",
  DICTIONARY: "Named mention",
  DERIVED: "Derived from raw ingestion",
  CONCEPTUAL: "Conceptual link",
};

interface FGNode extends GraphNode {
  x?: number;
  y?: number;
}
interface FGLink extends Omit<GraphEdge, "source" | "target"> {
  source: string | FGNode;
  target: string | FGNode;
}

type Selection = { type: "node"; node: FGNode } | { type: "edge"; edge: FGLink } | null;

function nodeHref(node: GraphNode): string | null {
  const [type, id] = node.id.split(":");
  if (type === "TRACKER") return `/trackers/${id}`;
  return null;
}

function endpointLabel(end: string | FGNode): string {
  return typeof end === "string" ? end : end.label;
}

export default function KnowledgeGraph({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [size, setSize] = useState({ width: 900, height: 520 });
  const [visibleKinds, setVisibleKinds] = useState<Set<GraphEdge["kind"]>>(new Set(["STRUCTURAL", "DICTIONARY", "CONCEPTUAL", "DERIVED"]));
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

  const graphData = useMemo(
    () => ({
      nodes: filteredNodes.map((n) => ({ ...n })) as FGNode[],
      links: filteredEdges.map((e) => ({ ...e })) as unknown as FGLink[],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredNodes, filteredEdges],
  );

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
    let instance: any = null;

    import("force-graph").then(({ default: ForceGraph }) => {
      if (cancelled || !canvasHostRef.current) return;
      instance = new ForceGraph(canvasHostRef.current)
        .graphData(graphData)
        .width(size.width)
        .height(size.height)
        .nodeRelSize(1)
        .nodeVal((n: any) => NODE_RADIUS[n.type as GraphNode["type"]] ** 2)
        .nodeColor((n: any) => NODE_COLOR[n.type as GraphNode["type"]])
        .nodeLabel(() => "")
        .linkColor((l: any) => EDGE_STYLE[l.kind as GraphEdge["kind"]].color)
        .linkWidth((l: any) => EDGE_STYLE[l.kind as GraphEdge["kind"]].width)
        .linkLineDash((l: any) => EDGE_STYLE[l.kind as GraphEdge["kind"]].dash ?? null)
        .linkDirectionalParticles(0)
        .cooldownTime(4000)
        .d3AlphaDecay(0.015)
        .d3VelocityDecay(0.28)
        .onNodeClick((n: any) => setSelection({ type: "node", node: n as FGNode }))
        .onLinkClick((l: any) => setSelection({ type: "edge", edge: l as FGLink }))
        .onBackgroundClick(() => setSelection(null))
        .nodeCanvasObject((n: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const type = n.type as GraphNode["type"];
          const r = NODE_RADIUS[type];
          ctx.beginPath();
          ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI);
          ctx.fillStyle = NODE_COLOR[type];
          ctx.fill();

          if (ALWAYS_LABELED.has(type)) {
            const fontSize = 11 / globalScale;
            ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
            ctx.fillText(n.label, n.x ?? 0, (n.y ?? 0) + r + 3);
          }
        })
        .nodePointerAreaPaint((n: any, color: string, ctx: CanvasRenderingContext2D) => {
          const r = NODE_RADIUS[n.type as GraphNode["type"]] + 3;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI);
          ctx.fill();
        })
        // Fit the whole graph into the visible canvas once the simulation
        // settles, instead of leaving it at whatever zoom/pan the physics
        // happened to end up at — re-fit on every engine-stop (e.g. after a
        // filter toggle reruns the simulation), not just the first load.
        .onEngineStop(() => instance?.zoomToFit(400, 40));
      graphRef.current = instance;
    });

    return () => {
      cancelled = true;
      if (instance?._destructor) instance._destructor();
      if (canvasHostRef.current) canvasHostRef.current.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData]);

  useEffect(() => {
    graphRef.current?.width(size.width).height(size.height);
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
        {(["STRUCTURAL", "DICTIONARY", "CONCEPTUAL", "DERIVED"] as const).map((kind) => (
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
                {endpointLabel(selection.edge.source)} ↔ {endpointLabel(selection.edge.target)}
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
