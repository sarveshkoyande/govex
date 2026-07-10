"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import type { GraphNode, GraphEdge } from "@/lib/graphData";

const NODE_COLOR: Record<GraphNode["type"], string> = {
  TRACKER: "oklch(0.46 0.19 258)",
  DOMAIN: "oklch(0.65 0.15 200)",
  STAKEHOLDER: "oklch(0.60 0.15 30)",
};
const NODE_RADIUS: Record<GraphNode["type"], number> = {
  TRACKER: 22,
  DOMAIN: 16,
  STAKEHOLDER: 12,
};
const NODE_TYPE_LABEL: Record<GraphNode["type"], string> = {
  TRACKER: "Tracker",
  DOMAIN: "Domain",
  STAKEHOLDER: "Stakeholder",
};

interface Positioned extends GraphNode {
  x: number;
  y: number;
}

// A small dependency-free force-directed layout (Fruchterman-Reingold-style:
// nodes repel each other, connected nodes attract) — no graph library
// needed for a node count this small (a few dozen), and it keeps full
// control over styling to match the rest of the app.
function computeLayout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number): Positioned[] {
  const positioned: Positioned[] = nodes.map((n, i) => {
    const angle = (i / Math.max(1, nodes.length)) * 2 * Math.PI;
    return { ...n, x: width / 2 + Math.cos(angle) * (width / 3), y: height / 2 + Math.sin(angle) * (height / 3) };
  });
  const byId = new Map(positioned.map((n) => [n.id, n]));

  const AREA = width * height;
  const K = Math.sqrt(AREA / Math.max(1, nodes.length)) * 0.6;

  for (let iter = 0; iter < 200; iter++) {
    const disp = new Map<string, { x: number; y: number }>();
    for (const n of positioned) disp.set(n.id, { x: 0, y: 0 });

    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const a = positioned[i], b = positioned[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = (K * K) / dist;
        const ux = dx / dist, uy = dy / dist;
        disp.get(a.id)!.x += ux * force;
        disp.get(a.id)!.y += uy * force;
        disp.get(b.id)!.x -= ux * force;
        disp.get(b.id)!.y -= uy * force;
      }
    }
    for (const e of edges) {
      const a = byId.get(e.source), b = byId.get(e.target);
      if (!a || !b) continue;
      const dx = a.x - b.x, dy = a.y - b.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (dist * dist) / K;
      const ux = dx / dist, uy = dy / dist;
      disp.get(a.id)!.x -= ux * force * 0.5;
      disp.get(a.id)!.y -= uy * force * 0.5;
      disp.get(b.id)!.x += ux * force * 0.5;
      disp.get(b.id)!.y += uy * force * 0.5;
    }

    const temp = Math.max(1, K * (1 - iter / 200));
    for (const n of positioned) {
      const d = disp.get(n.id)!;
      const dLen = Math.max(0.01, Math.sqrt(d.x * d.x + d.y * d.y));
      n.x = Math.min(width - 20, Math.max(20, n.x + (d.x / dLen) * Math.min(dLen, temp)));
      n.y = Math.min(height - 20, Math.max(20, n.y + (d.y / dLen) * Math.min(dLen, temp)));
    }
  }
  return positioned;
}

const EDGE_STYLE: Record<GraphEdge["kind"], { dash?: string; color: string; width: number }> = {
  STRUCTURAL: { color: "oklch(0.75 0.01 255)", width: 1.5 },
  DICTIONARY: { dash: "4 3", color: "oklch(0.60 0.15 145)", width: 1.5 },
  CONCEPTUAL: { dash: "1 4", color: "oklch(0.65 0.20 25)", width: 1.5 },
};
const EDGE_KIND_LABEL: Record<GraphEdge["kind"], string> = {
  STRUCTURAL: "Structural relationship",
  DICTIONARY: "Named mention",
  CONCEPTUAL: "Conceptual link",
};

type Selection = { type: "node"; node: Positioned } | { type: "edge"; edge: GraphEdge; a: Positioned; b: Positioned } | null;

function nodeHref(node: GraphNode): string | null {
  const [type, id] = node.id.split(":");
  if (type === "TRACKER") return `/trackers/${id}`;
  return null; // domains/stakeholders don't have their own page yet
}

export default function KnowledgeGraph({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 900, height: 480 });
  const [visibleKinds, setVisibleKinds] = useState<Set<GraphEdge["kind"]>>(new Set(["STRUCTURAL", "DICTIONARY", "CONCEPTUAL"]));
  const [selection, setSelection] = useState<Selection>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const observer = new ResizeObserver(() => setSize({ width: el.clientWidth, height: 480 }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const filteredEdges = useMemo(() => edges.filter((e) => visibleKinds.has(e.kind)), [edges, visibleKinds]);
  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of filteredEdges) { ids.add(e.source); ids.add(e.target); }
    return ids;
  }, [filteredEdges]);
  const visibleNodes = useMemo(() => nodes.filter((n) => connectedNodeIds.has(n.id)), [nodes, connectedNodeIds]);
  const positioned = useMemo(() => computeLayout(visibleNodes, filteredEdges, size.width, size.height), [visibleNodes, filteredEdges, size]);
  const byId = useMemo(() => new Map(positioned.map((n) => [n.id, n])), [positioned]);

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
        {(["STRUCTURAL", "DICTIONARY", "CONCEPTUAL"] as const).map((kind) => (
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
        <span className="ml-auto text-[10px] text-muted-foreground">{visibleNodes.length} connected · {filteredEdges.length} links</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_240px]">
        <div ref={containerRef} className="overflow-hidden rounded-xl border border-border bg-card">
          <svg width={size.width} height={size.height} role="img" aria-label="Knowledge graph of this tracker's connections">
            {filteredEdges.map((e, i) => {
              const a = byId.get(e.source), b = byId.get(e.target);
              if (!a || !b) return null;
              const style = EDGE_STYLE[e.kind];
              const isSelected = selection?.type === "edge" && selection.edge === e;
              return (
                <line
                  key={i}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={style.color} strokeWidth={isSelected ? style.width + 1.5 : style.width} strokeDasharray={style.dash}
                  opacity={isSelected ? 1 : 0.6}
                  className="cursor-pointer"
                  onClick={() => setSelection({ type: "edge", edge: e, a, b })}
                />
              );
            })}
            {positioned.map((n) => {
              const isSelected = selection?.type === "node" && selection.node.id === n.id;
              return (
                <g key={n.id} className="cursor-pointer" onClick={() => setSelection({ type: "node", node: n })}>
                  <circle
                    cx={n.x} cy={n.y} r={NODE_RADIUS[n.type]}
                    fill={NODE_COLOR[n.type]} opacity={isSelected ? 1 : 0.88}
                    stroke={isSelected ? "white" : "none"} strokeWidth={isSelected ? 2 : 0}
                  />
                  <text x={n.x} y={n.y + NODE_RADIUS[n.type] + 13} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="currentColor" className="pointer-events-none select-none">
                    {n.label.length > 20 ? `${n.label.slice(0, 18)}…` : n.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
          {!selection && <p className="text-[11px] text-muted-foreground">Click a node or line for detail.</p>}
          {selection?.type === "node" && (
            <>
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{NODE_TYPE_LABEL[selection.node.type]}</p>
              <p className="text-sm font-bold text-foreground">{selection.node.label}</p>
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
              <p className="text-[11px] font-semibold leading-snug text-foreground">{selection.a.label} ↔ {selection.b.label}</p>
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
