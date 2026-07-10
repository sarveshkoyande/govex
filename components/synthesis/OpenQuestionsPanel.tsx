"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { approveAndSendQuestion, retrySendQuestion, dismissQuestion, reassignQuestion } from "@/app/actions/questions";
import { Send, X, Pencil, RefreshCw, CheckCircle2, Clock, HelpCircle, UserCog } from "lucide-react";

export interface QuestionRow {
  id: string;
  questionPattern: string;
  targetSummary: string;
  questionText: string;
  status: string; // DRAFT | APPROVED | ASKED | ANSWERED | DISMISSED
  deliveryStatus: string | null;
  deliveryError: string | null;
  stakeholderId: string | null;
  stakeholderName: string | null;
  createdAt: string;
  answeredEventText: string | null;
  answerVerdict: string | null; // USEFUL | NON_ANSWER
  answerVerdictReasoning: string | null;
}

export interface StakeholderOption {
  id: string;
  name: string;
}

const STATUS_CFG: Record<string, { label: string; cls: string; icon: typeof Clock }> = {
  DRAFT: { label: "Draft", cls: "bg-muted text-muted-foreground", icon: HelpCircle },
  APPROVED: { label: "Approved", cls: "bg-blue-50 text-blue-700", icon: Clock },
  ASKED: { label: "Asked", cls: "bg-amber-50 text-amber-700", icon: Clock },
  ANSWERED: { label: "Answered", cls: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  DISMISSED: { label: "Dismissed", cls: "bg-muted text-muted-foreground line-through", icon: X },
};

function QuestionCard({ row, stakeholders }: { row: QuestionRow; stakeholders: StakeholderOption[] }) {
  const [editing, setEditing] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [text, setText] = useState(row.questionText);
  const [pickedStakeholder, setPickedStakeholder] = useState(row.stakeholderId ?? "");
  const [pending, startTransition] = useTransition();
  const [local, setLocal] = useState(row);

  const cfg = STATUS_CFG[local.status] ?? STATUS_CFG.DRAFT;
  const Icon = cfg.icon;

  function approveAndSend() {
    startTransition(async () => {
      const res = await approveAndSendQuestion(row.id, { questionText: text });
      if (!res.ok) { toast.error(res.error); return; }
      const label = res.data.status === "SENT" ? "Sent." : res.data.status === "NOT_CONFIGURED" ? "Marked asked — no outbound webhook configured yet." : `Send failed: ${res.data.status}`;
      toast(label);
      setLocal((p) => ({ ...p, status: "ASKED", deliveryStatus: res.data.status, questionText: text }));
    });
  }
  function retry() {
    startTransition(async () => {
      const res = await retrySendQuestion(row.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast(res.data.status === "SENT" ? "Sent." : `Still not delivered: ${res.data.status}`);
      setLocal((p) => ({ ...p, deliveryStatus: res.data.status }));
    });
  }
  function dismiss() {
    startTransition(async () => {
      const res = await dismissQuestion(row.id);
      if (!res.ok) { toast.error(res.error); return; }
      setLocal((p) => ({ ...p, status: "DISMISSED" }));
    });
  }
  function reassign() {
    startTransition(async () => {
      const res = await reassignQuestion(row.id, pickedStakeholder || null);
      if (!res.ok) { toast.error(res.error); return; }
      const newName = stakeholders.find((s) => s.id === pickedStakeholder)?.name ?? null;
      if (res.data.status === "NOT_SENT_YET") {
        toast.success("Reassigned.");
      } else {
        toast.success(res.data.status === "SENT" ? `Reassigned and resent to ${newName ?? "the new stakeholder"}.` : `Reassigned — resend ${res.data.status.toLowerCase()}.`);
      }
      setLocal((p) => ({ ...p, stakeholderName: newName, deliveryStatus: res.data.status === "NOT_SENT_YET" ? p.deliveryStatus : res.data.status }));
      setReassigning(false);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", cfg.cls)}>
          <Icon size={9} /> {cfg.label}
        </span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase text-muted-foreground">{local.questionPattern.replace(/_/g, " ")}</span>
        {local.stakeholderName && <span className="text-[10px] text-muted-foreground">→ {local.stakeholderName}</span>}
        <button
          type="button"
          onClick={() => setReassigning((v) => !v)}
          className="flex items-center gap-0.5 rounded-full border border-border px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground hover:bg-muted"
          title="Change who this is tagged to"
        >
          <UserCog size={9} /> Reassign
        </button>
        {local.status === "ASKED" && local.deliveryStatus && (
          <span className={cn("ml-auto text-[9px] font-semibold", local.deliveryStatus === "SENT" ? "text-emerald-600" : local.deliveryStatus === "NOT_CONFIGURED" ? "text-muted-foreground" : "text-destructive")}>
            {local.deliveryStatus}
          </span>
        )}
      </div>

      {reassigning && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-card p-2">
          <select
            value={pickedStakeholder}
            onChange={(e) => setPickedStakeholder(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
          >
            <option value="">— unassigned —</option>
            {stakeholders.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Button size="sm" onClick={reassign} disabled={pending}>Save &amp; resend</Button>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">{local.targetSummary}</p>

      {editing && local.status === "DRAFT" ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[60px] rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs" />
      ) : (
        <p className="text-sm font-medium text-foreground">{local.questionText}</p>
      )}

      {local.answeredEventText && (
        <div className="mt-1 rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-800">
          <span className="font-bold uppercase tracking-wide text-emerald-600">Reply: </span>
          {local.answeredEventText}
        </div>
      )}

      {local.answerVerdict && (
        <div className="flex items-start gap-1.5">
          <span className={cn("flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase", local.answerVerdict === "USEFUL" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
            {local.answerVerdict === "USEFUL" ? "Useful answer" : "Non-answer"}
          </span>
          {local.answerVerdictReasoning && <span className="text-[10px] italic text-muted-foreground">{local.answerVerdictReasoning}</span>}
        </div>
      )}

      {local.status === "DRAFT" && (
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={approveAndSend} disabled={pending}><Send size={12} /> Approve &amp; Send</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)} disabled={pending}><Pencil size={12} /> {editing ? "Done" : "Edit"}</Button>
          <Button size="sm" variant="ghost" onClick={dismiss} disabled={pending} className="text-destructive hover:text-destructive"><X size={12} /> Dismiss</Button>
        </div>
      )}
      {local.status === "ASKED" && local.deliveryStatus !== "SENT" && (
        <div className="pt-1">
          <Button size="sm" variant="outline" onClick={retry} disabled={pending}><RefreshCw size={12} /> Retry send</Button>
        </div>
      )}
    </div>
  );
}

export default function OpenQuestionsPanel({ rows, stakeholders }: { rows: QuestionRow[]; stakeholders: StakeholderOption[] }) {
  const active = rows.filter((r) => r.status !== "DISMISSED");
  if (active.length === 0) {
    return <p className="text-xs text-muted-foreground">No open questions. Use &quot;Draft Questions (AI)&quot; above to scan for gaps.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {active.map((row) => <QuestionCard key={row.id} row={row} stakeholders={stakeholders} />)}
    </div>
  );
}
