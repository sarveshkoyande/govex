"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { approveSuggestion, rejectSuggestion } from "@/app/actions/synthesis";
import { SignalPill, ConfidenceBadge } from "@/components/trackers/display";
import { Check, X, Pencil, ChevronDown } from "lucide-react";

export interface SuggestionRow {
  id: string;
  kind: string; // STRATEGY_INSIGHT | TACTIC_EXECUTION | TACTIC_OUTCOME
  title: string | null;
  text: string;
  signal: string;
  confidence: number;
  rationale: string | null;
  status: string; // PENDING | APPROVED | REJECTED
  createdAt: string;
  reviewedBy: string | null;
  tacticLabel: string | null;
  sourceEventCount: number;
}

const KIND_LABEL: Record<string, string> = {
  STRATEGY_INSIGHT: "Strategy vs Outcome",
  TACTIC_EXECUTION: "Execution Insight",
  TACTIC_OUTCOME: "Outcome Insight",
};

function PendingCard({ row }: { row: SuggestionRow }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(row.text);
  const [title, setTitle] = useState(row.title ?? "");
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState(false);

  function approve() {
    startTransition(async () => {
      const res = await approveSuggestion(row.id, { text, title: title || undefined });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Approved — now live on the tracker.");
      setHidden(true);
    });
  }
  function reject() {
    startTransition(async () => {
      const res = await rejectSuggestion(row.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast("Rejected.");
      setHidden(true);
    });
  }

  if (hidden) return null;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">{KIND_LABEL[row.kind] ?? row.kind}</span>
        {row.tacticLabel && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{row.tacticLabel}</span>}
        <SignalPill signal={row.signal} />
        <ConfidenceBadge value={row.confidence} />
        <span className="ml-auto text-[10px] text-muted-foreground">{row.sourceEventCount} source event{row.sourceEventCount !== 1 ? "s" : ""}</span>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          {row.kind === "STRATEGY_INSIGHT" && (
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold" placeholder="Title" />
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[80px] rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" />
        </div>
      ) : (
        <div>
          {row.title && <p className="text-sm font-bold text-foreground">{row.title}</p>}
          <p className="text-sm leading-relaxed text-foreground">{row.text}</p>
        </div>
      )}

      {row.rationale && (
        <p className="text-[11px] italic text-muted-foreground">Why: {row.rationale}</p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={approve} disabled={pending}>
          <Check size={13} /> Approve
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)} disabled={pending}>
          <Pencil size={13} /> {editing ? "Done editing" : "Edit"}
        </Button>
        <Button size="sm" variant="ghost" onClick={reject} disabled={pending} className="text-destructive hover:text-destructive">
          <X size={13} /> Reject
        </Button>
      </div>
    </div>
  );
}

function DecidedRow({ row }: { row: SuggestionRow }) {
  return (
    <div className="flex items-center gap-2 border-b border-border/50 py-2 text-[11px] last:border-0">
      <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase", row.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground")}>{row.status}</span>
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">{KIND_LABEL[row.kind] ?? row.kind}</span>
      <span className="flex-1 truncate text-foreground/80">{row.title ?? row.text}</span>
      <span className="text-muted-foreground">{row.reviewedBy}</span>
    </div>
  );
}

export default function ReviewQueue({ pending, decided }: { pending: SuggestionRow[]; decided: SuggestionRow[] }) {
  const [showDecided, setShowDecided] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pending ({pending.length})</p>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-xs text-muted-foreground">
            Nothing to review. Run &quot;Generate Insights (AI)&quot; on the tracker page.
          </p>
        ) : (
          pending.map((row) => <PendingCard key={row.id} row={row} />)
        )}
      </div>

      {decided.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowDecided((v) => !v)} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
            <ChevronDown size={13} className={cn("transition-transform", showDecided && "rotate-180")} />
            History ({decided.length})
          </button>
          {showDecided && (
            <div className="mt-2 rounded-xl border border-border bg-card p-3">
              {decided.map((row) => <DecidedRow key={row.id} row={row} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
