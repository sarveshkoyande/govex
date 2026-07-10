"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { reenablePattern } from "@/app/actions/questions";
import { RotateCcw } from "lucide-react";

export interface PatternRow {
  questionPattern: string;
  askedCount: number;
  answeredCount: number;
  usefulCount: number;
  nonAnswerCount: number;
  enabled: boolean;
  disabledAt: string | null;
  disabledReason: string | null;
}

function Row({ row }: { row: PatternRow }) {
  const [local, setLocal] = useState(row);
  const [pending, startTransition] = useTransition();
  const usefulRate = local.answeredCount > 0 ? Math.round((local.usefulCount / local.answeredCount) * 100) : null;

  function reenable() {
    startTransition(async () => {
      const res = await reenablePattern(row.questionPattern);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Pattern re-enabled — it will be drafted again.");
      setLocal((p) => ({ ...p, enabled: true }));
    });
  }

  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="py-2 pr-3 font-mono text-[11px] font-semibold text-foreground">{local.questionPattern.replace(/_/g, " ")}</td>
      <td className="py-2 pr-3 tabular-nums">{local.askedCount}</td>
      <td className="py-2 pr-3 tabular-nums">{local.answeredCount}</td>
      <td className="py-2 pr-3 tabular-nums">{local.usefulCount}</td>
      <td className="py-2 pr-3 tabular-nums">{local.nonAnswerCount}</td>
      <td className="py-2 pr-3">
        {usefulRate === null ? <span className="text-muted-foreground">—</span> : (
          <span className={cn("font-semibold", usefulRate < 34 ? "text-destructive" : usefulRate < 67 ? "text-amber-600" : "text-emerald-600")}>{usefulRate}%</span>
        )}
      </td>
      <td className="py-2">
        {local.enabled ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-700">Enabled</span>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="w-fit rounded-full bg-destructive/10 px-2 py-0.5 text-[9px] font-bold uppercase text-destructive">Disabled</span>
            {local.disabledReason && <span className="text-[10px] text-muted-foreground">{local.disabledReason}</span>}
            <Button size="sm" variant="outline" onClick={reenable} disabled={pending} className="w-fit"><RotateCcw size={11} /> Re-enable</Button>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function PatternStatsTable({ rows }: { rows: PatternRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-xs text-muted-foreground">No scored questions yet — patterns appear here once a stakeholder replies to an asked question.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card p-4">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
            <th className="py-1.5 pr-3 font-semibold">Pattern</th>
            <th className="py-1.5 pr-3 font-semibold">Asked</th>
            <th className="py-1.5 pr-3 font-semibold">Answered</th>
            <th className="py-1.5 pr-3 font-semibold">Useful</th>
            <th className="py-1.5 pr-3 font-semibold">Non-answer</th>
            <th className="py-1.5 pr-3 font-semibold">Useful rate</th>
            <th className="py-1.5 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => <Row key={r.questionPattern} row={r} />)}
        </tbody>
      </table>
    </div>
  );
}
