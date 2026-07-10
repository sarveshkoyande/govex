"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, AlertTriangle, User, Users, ChevronDown } from "lucide-react";

export interface RailAction {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  status: string; // open | in_progress | done
  priority: string; // high | medium | low
  assigneeGroup: string; // you | team
  theme: string;
  trackerId: string;
}

const STATUS_CFG: Record<string, { icon: typeof Circle; color: string; bg: string; border: string }> = {
  open:        { icon: Circle,       color: "text-muted-foreground",                  bg: "bg-muted/60",                      border: "border-border" },
  in_progress: { icon: Clock,        color: "text-blue-600",                          bg: "bg-blue-50",                       border: "border-blue-200" },
  done:        { icon: CheckCircle2, color: "text-emerald-600",                       bg: "bg-emerald-50",                    border: "border-emerald-200" },
};

const PRIORITY_CFG: Record<string, { label: string; badge: string }> = {
  high:   { label: "High",   badge: "bg-red-100 text-red-700" },
  medium: { label: "Medium", badge: "bg-amber-100 text-amber-700" },
  low:    { label: "Low",    badge: "bg-muted text-muted-foreground" },
};

function Row({ a }: { a: RailAction }) {
  const s = STATUS_CFG[a.status] ?? STATUS_CFG.open;
  const p = PRIORITY_CFG[a.priority] ?? PRIORITY_CFG.medium;
  const Icon = s.icon;
  return (
    <Link href={`/trackers/${a.trackerId}`} className={cn("flex flex-col gap-1.5 rounded-lg border p-2.5 transition-colors hover:brightness-[0.99]", s.bg, s.border)}>
      <div className="flex items-start gap-2">
        <Icon size={14} className={cn("mt-0.5 flex-shrink-0", s.color)} aria-hidden="true" />
        <span className={cn("flex-1 text-xs font-medium leading-snug", a.status === "done" ? "text-muted-foreground line-through" : "text-foreground")}>
          {a.title}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-5">
        <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", p.badge)}>{p.label}</span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{a.theme}</span>
        {a.owner && a.owner !== "—" && <span className="text-[10px] text-muted-foreground">{a.owner}</span>}
        {a.dueDate && a.dueDate !== "—" && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Clock size={9} aria-hidden="true" />
            {a.dueDate}
          </span>
        )}
      </div>
    </Link>
  );
}

function Section({ group, actions }: { group: "you" | "team"; actions: RailAction[] }) {
  const [open, setOpen] = useState(true);
  const isYou = group === "you";
  const openCount = actions.filter((a) => a.status === "open").length;

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors", isYou ? "bg-primary/10 hover:bg-primary/15" : "bg-muted/70 hover:bg-muted")}
      >
        <div className={cn("flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md", isYou ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground")}>
          {isYou ? <User size={11} /> : <Users size={11} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className={cn("text-[11px] font-bold leading-none", isYou ? "text-primary" : "text-foreground")}>{isYou ? "For you" : "For the team"}</p>
          <p className="mt-0.5 text-[9px] leading-none text-muted-foreground">
            {actions.length} action{actions.length !== 1 ? "s" : ""}{openCount > 0 && ` · ${openCount} open`}
          </p>
        </div>
        <ChevronDown size={12} className={cn("flex-shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div className="flex flex-col gap-1.5 pl-1">
          {actions.length === 0 ? (
            <p className="py-3 text-center text-[11px] text-muted-foreground">No actions.</p>
          ) : (
            actions.map((a) => <Row key={a.id} a={a} />)
          )}
        </div>
      )}
    </div>
  );
}

export default function ActionRail({ actions, scopeLabel }: { actions: RailAction[]; scopeLabel: string }) {
  const [filter, setFilter] = useState<"all" | "open" | "in_progress" | "done">("all");

  const filtered = filter === "all" ? actions : actions.filter((a) => a.status === filter);
  const you = filtered.filter((a) => a.assigneeGroup === "you");
  const team = filtered.filter((a) => a.assigneeGroup === "team");

  const total = actions.length;
  const openCount = actions.filter((a) => a.status === "open").length;
  const inProg = actions.filter((a) => a.status === "in_progress").length;
  const done = actions.filter((a) => a.status === "done").length;

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col overflow-hidden border-l border-border bg-card" aria-label="Action Tracker">
      <div className="flex-shrink-0 border-b border-border px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Action Tracker</h2>
          {openCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600">
              <AlertTriangle size={10} aria-hidden="true" />
              {openCount} open
            </span>
          )}
        </div>
        <p className="mb-2 text-[10px] text-muted-foreground">
          {scopeLabel}
          {total > 0 && ` · ${total} action${total !== 1 ? "s" : ""}`}
        </p>
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            {total > 0 && (
              <>
                <div className="h-full bg-red-400" style={{ width: `${(openCount / total) * 100}%` }} />
                <div className="h-full bg-blue-400" style={{ width: `${(inProg / total) * 100}%` }} />
                <div className="h-full bg-emerald-400" style={{ width: `${(done / total) * 100}%` }} />
              </>
            )}
          </div>
          <span className="whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">{done}/{total} done</span>
        </div>
        <div className="flex gap-1">
          {(["all", "open", "in_progress", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn("flex-1 rounded-md px-1 py-1 text-[10px] font-semibold transition-colors", filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80")}
            >
              {f === "all" ? "All" : f === "in_progress" ? "Active" : f === "done" ? "Done" : "Open"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
        <Section group="you" actions={you} />
        <Section group="team" actions={team} />
      </div>

      <div className="flex-shrink-0 border-t border-border px-4 py-3">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Actions are managed on each tracker&apos;s edit page in Stage 0.
        </p>
      </div>
    </aside>
  );
}
