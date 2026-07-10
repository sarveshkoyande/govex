"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { saveTracker, deleteTracker } from "@/app/actions/trackers";
import { draftTacticInsightFromUpdate, draftStrategyVsOutcome } from "@/app/actions/aiDraft";
import {
  type TrackerDraft, blankStakeholder, blankRisk, blankAction,
  blankDecision, blankGoal, blankOkr, blankMicroBattle, blankTactic, blankInsight,
  blankStrategyInsight,
} from "@/lib/types";
import {
  LIFECYCLE_STATUS, RAG, SIGNAL_STATUS, RISK_SEVERITY, RISK_STATUS, ACTION_PRIORITY,
  ACTION_STATUS, ACTION_ASSIGNEE, TACTIC_STATUS, INSIGHT_SIGNAL,
} from "@/lib/enums";
import { Plus, Trash2, Save, ChevronDown, X, ChevronLeft, ChevronRight, Sparkles, Loader2 } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

function In(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}
function Ta(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "min-h-[60px] resize-y", props.className)} />;
}
function Sel({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
// Controlled by the parent form's single `openSection` state so opening one
// section collapses whichever was previously open — mirrors moving through
// the sample UI's Strategy/Execution/Outcomes tabs one at a time instead of
// scrolling one long page.
function Section({
  id, title, subtitle, count, children, open, onToggle, headerExtra,
}: {
  id: string; title: string; subtitle?: string; count?: number; children: React.ReactNode;
  open: boolean; onToggle: (id: string) => void; headerExtra?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button type="button" onClick={() => onToggle(id)} className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-muted/40">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{title}{count != null && <span className="ml-2 text-xs font-normal text-muted-foreground">({count})</span>}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {headerExtra}
        <ChevronDown size={14} className={cn("flex-shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </div>
  );
}
function RepeaterItem({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="relative rounded-lg border border-border bg-muted/30 p-3 pr-9">
      {children}
      <button type="button" onClick={onRemove} className="absolute right-2 top-2 text-muted-foreground hover:text-destructive" aria-label="Remove">
        <X size={13} />
      </button>
    </div>
  );
}
function AddBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/5">
      <Plus size={13} /> {label}
    </button>
  );
}
/* compact signal + text insight row editor */
function InsightRows({ items, onChange }: { items: { signal: string; text: string }[]; onChange: (fn: (arr: { signal: string; text: string }[]) => void) => void }) {
  return (
    <div className="flex flex-col gap-1">
      {items.map((ins, i) => (
        <div key={i} className="flex items-start gap-1">
          <div className="grid flex-1 grid-cols-4 gap-1">
            <In className="col-span-3" placeholder="Insight text" value={ins.text} onChange={(e) => onChange((arr) => { arr[i].text = e.target.value; })} />
            <select value={ins.signal} onChange={(e) => onChange((arr) => { arr[i].signal = e.target.value; })} className={inputCls}>
              {INSIGHT_SIGNAL.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => onChange((arr) => { arr.splice(i, 1); })} className="mt-1 text-muted-foreground hover:text-destructive"><X size={11} /></button>
        </div>
      ))}
    </div>
  );
}
// Small "paste an update, generate a draft insight" panel — lives inside one
// tactic. Never writes anything itself; the draft returned just gets pushed
// into the same local form state as manually-typed insight rows, so it's
// editable/removable and only persisted when the whole form is saved.
function UpdateInsightPanel({
  trackerName, microBattleName, tacticName, expectedOutcome, currentStatus, onDraft,
}: {
  trackerName: string; microBattleName: string; tacticName: string; expectedOutcome: string; currentStatus: string;
  onDraft: (result: { executionInsight: { signal: string; text: string } | null; outcomeInsight: { signal: string; text: string } | null; suggestedStatus: string | null }) => void;
}) {
  const [updateText, setUpdateText] = useState("");
  const [pending, startTransition] = useTransition();

  function generate() {
    if (!updateText.trim()) { toast.error("Paste an update first."); return; }
    startTransition(async () => {
      const res = await draftTacticInsightFromUpdate({
        trackerName, microBattleName, tacticName, expectedOutcome, currentStatus, updateText,
      });
      if (!res.ok) { toast.error(res.error); return; }
      if (!res.data.executionInsight && !res.data.outcomeInsight && !res.data.suggestedStatus) {
        toast.info("Nothing insight-worthy found in that update.");
        return;
      }
      onDraft(res.data);
      setUpdateText("");
      toast.success("Draft added below — review and edit before saving.");
    });
  }

  return (
    <div className="mt-2 rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] p-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-primary">
        <Sparkles size={11} /> Paste an update to auto-draft insights
      </p>
      <Ta
        value={updateText}
        onChange={(e) => setUpdateText(e.target.value)}
        placeholder="Paste a status email, meeting note, or quick summary about this tactic…"
        className="min-h-[50px] bg-background"
      />
      <div className="mt-1.5 flex justify-end">
        <Button type="button" size="sm" onClick={generate} disabled={pending}>
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Generate draft
        </Button>
      </div>
    </div>
  );
}

export default function TrackerForm({
  initial, domains, mode,
}: {
  initial: TrackerDraft;
  domains: { id: string; name: string }[];
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [t, setT] = useState<TrackerDraft>(initial);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [openSection, setOpenSection] = useState<string>("overview");
  const [mbIndex, setMbIndex] = useState(0);
  const [tacticIndex, setTacticIndex] = useState(0);
  const [genStrategyPending, startGenStrategy] = useTransition();

  const toggleSection = (id: string) => setOpenSection((prev) => (prev === id ? "" : id));

  const update = (mut: (d: TrackerDraft) => void) =>
    setT((prev) => { const next = structuredClone(prev); mut(next); return next; });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!t.name.trim()) return toast.error("Tracker name is required.");
    if (!t.domainId) return toast.error("Please choose a domain.");
    startTransition(async () => {
      const res = await saveTracker(t);
      if (res && !res.ok) toast.error(res.error);
    });
  }
  function onDelete() {
    if (!t.id) return;
    if (!confirm("Delete this tracker and all its data? This cannot be undone.")) return;
    startDelete(async () => {
      const res = await deleteTracker(t.id!);
      if (res && !res.ok) toast.error(res.error);
    });
  }

  function generateStrategyVsOutcome() {
    startGenStrategy(async () => {
      const res = await draftStrategyVsOutcome({
        trackerName: t.name || "(untitled tracker)",
        strategyGoals: t.strategyGoals.map((g) => g.text).filter(Boolean),
        okrs: t.okrs.map((o) => ({ title: o.title, metrics: o.metrics })),
        existingStrategyInsights: t.strategyInsights.map((s) => ({ title: s.title, description: s.description })),
        tactics: t.microBattles.flatMap((mb) =>
          mb.tactics.map((tac) => ({
            microBattleName: mb.name, name: tac.name, status: tac.status, expectedOutcome: tac.expectedOutcome,
            executionInsights: tac.executionInsights, outcomeInsights: tac.outcomeInsights,
          })),
        ),
      });
      if (!res.ok) { toast.error(res.error); return; }
      if (res.data.insights.length === 0) { toast.info("Not enough recorded data yet to draft strategy-vs-outcome cards."); return; }
      update((d) => { d.strategyInsights.push(...res.data.insights); });
      toast.success(`Drafted ${res.data.insights.length} strategy-vs-outcome card(s) — review before saving.`);
    });
  }

  const mb = t.microBattles[mbIndex];
  const tac = mb?.tactics[tacticIndex];

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pb-24">
      {/* Overview */}
      <Section id="overview" open={openSection === "overview"} onToggle={toggleSection} title="Overview" subtitle="Core tracker fields, status, owner, target period">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Name *" className="md:col-span-2"><In value={t.name} onChange={(e) => update((d) => { d.name = e.target.value; })} placeholder="e.g. BioPharm & Media Integration" /></Field>
          <Field label="Domain *">
            <select value={t.domainId} onChange={(e) => update((d) => { d.domainId = e.target.value; })} className={inputCls}>
              <option value="">Select domain…</option>
              {domains.map((dm) => <option key={dm.id} value={dm.id}>{dm.name}</option>)}
            </select>
          </Field>
          <Field label="Owner"><In value={t.ownerName} onChange={(e) => update((d) => { d.ownerName = e.target.value; })} placeholder="e.g. Vivek Ghai" /></Field>
          <Field label="Description" className="md:col-span-2"><Ta value={t.description} onChange={(e) => update((d) => { d.description = e.target.value; })} /></Field>
          <Field label="Lifecycle"><Sel value={t.lifecycleStatus} onChange={(v) => update((d) => { d.lifecycleStatus = v; })} options={LIFECYCLE_STATUS} /></Field>
          <Field label="RAG"><Sel value={t.ragStatus} onChange={(v) => update((d) => { d.ragStatus = v; })} options={RAG} /></Field>
          <Field label="Signal"><Sel value={t.signalStatus} onChange={(v) => update((d) => { d.signalStatus = v; })} options={SIGNAL_STATUS} /></Field>
          <Field label="Target Period"><In value={t.targetPeriod} onChange={(e) => update((d) => { d.targetPeriod = e.target.value; })} placeholder="FY27 / CY2026" /></Field>
          <Field label={`Overall confidence: ${t.overallConfidence}%`} className="md:col-span-2">
            <input type="range" min={0} max={100} value={t.overallConfidence} onChange={(e) => update((d) => { d.overallConfidence = Number(e.target.value); })} className="w-full accent-[var(--primary)]" />
          </Field>
        </div>
      </Section>

      {/* Strategy: goals + OKRs */}
      <Section id="strategy" open={openSection === "strategy"} onToggle={toggleSection} title="Strategy" subtitle="Integration hypothesis / objectives and OKRs (Strategy tab)" count={t.strategyGoals.length + t.okrs.length}>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-primary">Integration Hypothesis &amp; Objective</p>
        <div className="mb-4 flex flex-col gap-2">
          {t.strategyGoals.map((g, i) => (
            <div key={i} className="flex items-center gap-1">
              <In value={g.text} onChange={(e) => update((d) => { d.strategyGoals[i].text = e.target.value; })} placeholder="Strategic goal / hypothesis" />
              <button type="button" onClick={() => update((d) => { d.strategyGoals.splice(i, 1); })} className="text-muted-foreground hover:text-destructive"><X size={13} /></button>
            </div>
          ))}
          <AddBtn onClick={() => update((d) => { d.strategyGoals.push(blankGoal()); })} label="Add strategic goal" />
        </div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">OKRs</p>
        <div className="flex flex-col gap-2">
          {t.okrs.map((o, i) => (
            <RepeaterItem key={i} onRemove={() => update((d) => { d.okrs.splice(i, 1); })}>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <Field label="Title" className="md:col-span-2"><In value={o.title} onChange={(e) => update((d) => { d.okrs[i].title = e.target.value; })} /></Field>
                <Field label="Metrics"><In value={o.metrics} onChange={(e) => update((d) => { d.okrs[i].metrics = e.target.value; })} placeholder="20% YoY growth" /></Field>
                <Field label="Tags (comma-sep)"><In value={o.tags} onChange={(e) => update((d) => { d.okrs[i].tags = e.target.value; })} placeholder="Media" /></Field>
              </div>
            </RepeaterItem>
          ))}
          <AddBtn onClick={() => update((d) => { d.okrs.push(blankOkr()); })} label="Add OKR" />
        </div>
      </Section>

      {/* Micro-battles → tactics → insights (Execution + Outcomes tabs) — one
          battle and one tactic at a time, with quick prev/next nav, instead
          of rendering the whole tree at once (this is what made the form
          unusably long). */}
      <Section id="microbattles" open={openSection === "microbattles"} onToggle={toggleSection} title="Micro-Battles" subtitle="Execution tactics, expected outcomes, and signal-tagged insights" count={t.microBattles.length}>
        {t.microBattles.length === 0 ? (
          <AddBtn onClick={() => { update((d) => { d.microBattles.push(blankMicroBattle()); }); setMbIndex(0); setTacticIndex(0); }} label="Add micro-battle" />
        ) : (
          <div className="flex flex-col gap-3">
            {/* micro-battle nav */}
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-2 py-1.5">
              <button type="button" disabled={mbIndex === 0} onClick={() => { setMbIndex((i) => i - 1); setTacticIndex(0); }} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
              <span className="text-[11px] font-bold text-foreground">Micro-Battle {mbIndex + 1} of {t.microBattles.length}</span>
              <button type="button" disabled={mbIndex === t.microBattles.length - 1} onClick={() => { setMbIndex((i) => i + 1); setTacticIndex(0); }} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Micro-Battle {mbIndex + 1}</span>
                <button
                  type="button"
                  onClick={() => {
                    update((d) => { d.microBattles.splice(mbIndex, 1); });
                    setMbIndex((i) => Math.max(0, Math.min(i, t.microBattles.length - 2)));
                    setTacticIndex(0);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Field label="Code"><In value={mb.code} onChange={(e) => update((d) => { d.microBattles[mbIndex].code = e.target.value; })} placeholder="MB1" /></Field>
                <Field label="Name" className="md:col-span-2"><In value={mb.name} onChange={(e) => update((d) => { d.microBattles[mbIndex].name = e.target.value; })} /></Field>
                <Field label="RAG"><Sel value={mb.ragStatus} onChange={(v) => update((d) => { d.microBattles[mbIndex].ragStatus = v; })} options={RAG} /></Field>
              </div>

              <div className="mt-3 border-l-2 border-primary/20 pl-3">
                {mb.tactics.length === 0 ? (
                  <AddBtn onClick={() => { update((d) => { d.microBattles[mbIndex].tactics.push(blankTactic()); }); setTacticIndex(0); }} label="Add execution tactic" />
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* tactic nav */}
                    <div className="flex items-center justify-between rounded-lg bg-muted/40 px-2 py-1.5">
                      <button type="button" disabled={tacticIndex === 0} onClick={() => setTacticIndex((i) => i - 1)} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-[10px] font-bold text-foreground">Execution Tactic {tacticIndex + 1} of {mb.tactics.length}</span>
                      <button type="button" disabled={tacticIndex === mb.tactics.length - 1} onClick={() => setTacticIndex((i) => i + 1)} className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ChevronRight size={14} />
                      </button>
                    </div>

                    <div className="rounded-lg border border-border bg-card p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Execution Tactic {tacticIndex + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            update((d) => { d.microBattles[mbIndex].tactics.splice(tacticIndex, 1); });
                            setTacticIndex((i) => Math.max(0, Math.min(i, mb.tactics.length - 2)));
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                        <Field label="Tactic" className="md:col-span-3"><In value={tac.name} onChange={(e) => update((d) => { d.microBattles[mbIndex].tactics[tacticIndex].name = e.target.value; })} /></Field>
                        <Field label="Status"><Sel value={tac.status} onChange={(v) => update((d) => { d.microBattles[mbIndex].tactics[tacticIndex].status = v; })} options={TACTIC_STATUS} /></Field>
                        <Field label="Expected Outcome" className="md:col-span-4"><In value={tac.expectedOutcome} onChange={(e) => update((d) => { d.microBattles[mbIndex].tactics[tacticIndex].expectedOutcome = e.target.value; })} /></Field>
                      </div>

                      <UpdateInsightPanel
                        trackerName={t.name}
                        microBattleName={mb.name}
                        tacticName={tac.name}
                        expectedOutcome={tac.expectedOutcome}
                        currentStatus={tac.status}
                        onDraft={(result) => update((d) => {
                          const dt = d.microBattles[mbIndex].tactics[tacticIndex];
                          if (result.executionInsight) dt.executionInsights.push(result.executionInsight);
                          if (result.outcomeInsight) dt.outcomeInsights.push(result.outcomeInsight);
                          if (result.suggestedStatus) dt.status = result.suggestedStatus;
                        })}
                      />

                      <div className="mt-2">
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-primary">Execution Insights</p>
                        <InsightRows items={tac.executionInsights} onChange={(fn) => update((d) => fn(d.microBattles[mbIndex].tactics[tacticIndex].executionInsights))} />
                        <div className="mt-1"><AddBtn onClick={() => update((d) => { d.microBattles[mbIndex].tactics[tacticIndex].executionInsights.push(blankInsight()); })} label="Add execution insight" /></div>
                      </div>
                      <div className="mt-2">
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-emerald-600">Outcome Insights</p>
                        <InsightRows items={tac.outcomeInsights} onChange={(fn) => update((d) => fn(d.microBattles[mbIndex].tactics[tacticIndex].outcomeInsights))} />
                        <div className="mt-1"><AddBtn onClick={() => update((d) => { d.microBattles[mbIndex].tactics[tacticIndex].outcomeInsights.push(blankInsight()); })} label="Add outcome insight" /></div>
                      </div>
                    </div>
                    <AddBtn onClick={() => { update((d) => { d.microBattles[mbIndex].tactics.push(blankTactic()); }); setTacticIndex(mb.tactics.length); }} label="Add execution tactic" />
                  </div>
                )}
              </div>
            </div>
            <AddBtn onClick={() => { update((d) => { d.microBattles.push(blankMicroBattle()); }); setMbIndex(t.microBattles.length); setTacticIndex(0); }} label="Add micro-battle" />
          </div>
        )}
      </Section>

      {/* Strategy vs Outcome synthesis */}
      <Section
        id="strategyvsoutcome"
        open={openSection === "strategyvsoutcome"}
        onToggle={toggleSection}
        title="Strategy vs Outcome"
        subtitle="Layer-4 strategic insights synthesis"
        count={t.strategyInsights.length}
        headerExtra={
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); generateStrategyVsOutcome(); }}
            disabled={genStrategyPending}
            className="mr-1 flex items-center gap-1 rounded-md border border-primary/30 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
          >
            {genStrategyPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} Generate
          </button>
        }
      >
        <p className="mb-2 text-[11px] text-muted-foreground">AI-generated from the tracker&apos;s recorded strategy goals, OKRs, and execution/outcome insights above — review and edit before saving.</p>
        <div className="flex flex-col gap-2">
          {t.strategyInsights.map((s, i) => (
            <RepeaterItem key={i} onRemove={() => update((d) => { d.strategyInsights.splice(i, 1); })}>
              <Field label="Title"><In value={s.title} onChange={(e) => update((d) => { d.strategyInsights[i].title = e.target.value; })} /></Field>
              <Field label="Description" className="mt-2"><Ta value={s.description} onChange={(e) => update((d) => { d.strategyInsights[i].description = e.target.value; })} /></Field>
            </RepeaterItem>
          ))}
          <AddBtn onClick={() => update((d) => { d.strategyInsights.push(blankStrategyInsight()); })} label="Add strategic insight manually" />
        </div>
      </Section>

      {/* Financials — read-only summary here; real figures come from
          ingestion/synthesis, not manual override on this form. Minimized by
          default since it's the least frequently needed section. */}
      <Section id="financials" open={openSection === "financials"} onToggle={toggleSection} title="Financials" subtitle="Read-only — sourced from ingestion/synthesis, not editable here" count={t.financialMetrics.length}>
        <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Field label="Currency"><p className="text-xs font-semibold text-foreground">{t.currency || "—"}</p></Field>
          <Field label="Budget ($M)"><p className="text-xs font-semibold text-foreground">{t.budget || "—"}</p></Field>
          <Field label="Spend ($M)"><p className="text-xs font-semibold text-foreground">{t.spend || "—"}</p></Field>
          <Field label="Forecast ($M)"><p className="text-xs font-semibold text-foreground">{t.forecast || "—"}</p></Field>
        </div>
        {t.financialMetrics.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No detailed financial metrics recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {t.financialMetrics.map((f, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-3 md:grid-cols-4">
                <Field label="Label"><p className="text-xs text-foreground">{f.label || "—"}</p></Field>
                <Field label="Period"><p className="text-xs text-foreground">{f.period || "—"}</p></Field>
                <Field label="Planned"><p className="text-xs text-foreground">{f.planned || "—"}</p></Field>
                <Field label="Actual"><p className="text-xs text-foreground">{f.actual || "—"}</p></Field>
                <Field label="Forecast"><p className="text-xs text-foreground">{f.forecast || "—"}</p></Field>
                <Field label="Confidence"><p className="text-xs text-foreground">{f.confidence}%</p></Field>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Stakeholders */}
      <Section id="stakeholders" open={openSection === "stakeholders"} onToggle={toggleSection} title="Stakeholders" subtitle="Named owners and what each one owns" count={t.stakeholders.length}>
        <div className="flex flex-col gap-2">
          {t.stakeholders.map((s, i) => (
            <RepeaterItem key={i} onRemove={() => update((d) => { d.stakeholders.splice(i, 1); })}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Field label="Name"><In value={s.name} onChange={(e) => update((d) => { d.stakeholders[i].name = e.target.value; })} /></Field>
                <Field label="Email"><In value={s.email} onChange={(e) => update((d) => { d.stakeholders[i].email = e.target.value; })} /></Field>
                <Field label="Role"><In value={s.roleOnTracker} onChange={(e) => update((d) => { d.stakeholders[i].roleOnTracker = e.target.value; })} /></Field>
                <Field label="Owns what"><In value={s.ownsWhat} onChange={(e) => update((d) => { d.stakeholders[i].ownsWhat = e.target.value; })} /></Field>
              </div>
              <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <input type="checkbox" checked={s.isPrimary} onChange={(e) => update((d) => { d.stakeholders[i].isPrimary = e.target.checked; })} /> Primary stakeholder
              </label>
            </RepeaterItem>
          ))}
          <AddBtn onClick={() => update((d) => { d.stakeholders.push(blankStakeholder()); })} label="Add stakeholder" />
        </div>
      </Section>

      {/* Risks */}
      <Section id="risks" open={openSection === "risks"} onToggle={toggleSection} title="Risks" subtitle="Severity, status, mitigation" count={t.risks.length}>
        <div className="flex flex-col gap-2">
          {t.risks.map((r, i) => (
            <RepeaterItem key={i} onRemove={() => update((d) => { d.risks.splice(i, 1); })}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Field label="Title" className="md:col-span-2"><In value={r.title} onChange={(e) => update((d) => { d.risks[i].title = e.target.value; })} /></Field>
                <Field label="Severity"><Sel value={r.severity} onChange={(v) => update((d) => { d.risks[i].severity = v; })} options={RISK_SEVERITY} /></Field>
                <Field label="Status"><Sel value={r.status} onChange={(v) => update((d) => { d.risks[i].status = v; })} options={RISK_STATUS} /></Field>
                <Field label="Owner"><In value={r.owner} onChange={(e) => update((d) => { d.risks[i].owner = e.target.value; })} /></Field>
                <Field label="Confidence %"><In inputMode="numeric" value={String(r.confidence)} onChange={(e) => update((d) => { d.risks[i].confidence = Number(e.target.value) || 0; })} /></Field>
                <Field label="Mitigation" className="md:col-span-4"><In value={r.mitigation} onChange={(e) => update((d) => { d.risks[i].mitigation = e.target.value; })} /></Field>
              </div>
            </RepeaterItem>
          ))}
          <AddBtn onClick={() => update((d) => { d.risks.push(blankRisk()); })} label="Add risk" />
        </div>
      </Section>

      {/* Next actions */}
      <Section id="actions" open={openSection === "actions"} onToggle={toggleSection} title="Next Actions" subtitle="Owner, priority, due date, status" count={t.nextActions.length}>
        <div className="flex flex-col gap-2">
          {t.nextActions.map((a, i) => (
            <RepeaterItem key={i} onRemove={() => update((d) => { d.nextActions.splice(i, 1); })}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Field label="Title" className="md:col-span-2"><In value={a.title} onChange={(e) => update((d) => { d.nextActions[i].title = e.target.value; })} /></Field>
                <Field label="Owner"><In value={a.owner} onChange={(e) => update((d) => { d.nextActions[i].owner = e.target.value; })} /></Field>
                <Field label="Due"><In value={a.dueDate} onChange={(e) => update((d) => { d.nextActions[i].dueDate = e.target.value; })} placeholder="Oct 7 / Ongoing" /></Field>
                <Field label="Group"><Sel value={a.assigneeGroup} onChange={(v) => update((d) => { d.nextActions[i].assigneeGroup = v; })} options={ACTION_ASSIGNEE} /></Field>
                <Field label="Priority"><Sel value={a.priority} onChange={(v) => update((d) => { d.nextActions[i].priority = v; })} options={ACTION_PRIORITY} /></Field>
                <Field label="Status"><Sel value={a.status} onChange={(v) => update((d) => { d.nextActions[i].status = v; })} options={ACTION_STATUS} /></Field>
              </div>
            </RepeaterItem>
          ))}
          <AddBtn onClick={() => update((d) => { d.nextActions.push(blankAction()); })} label="Add action" />
        </div>
      </Section>

      {/* Decision log */}
      <Section id="decisions" open={openSection === "decisions"} onToggle={toggleSection} title="Decision Log" subtitle="Append-only record of decisions and rationale" count={t.decisionLog.length}>
        <div className="flex flex-col gap-2">
          {t.decisionLog.map((dl, i) => (
            <RepeaterItem key={i} onRemove={() => update((d) => { d.decisionLog.splice(i, 1); })}>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                <Field label="Decision" className="md:col-span-2"><In value={dl.decision} onChange={(e) => update((d) => { d.decisionLog[i].decision = e.target.value; })} /></Field>
                <Field label="Decided by"><In value={dl.decidedBy} onChange={(e) => update((d) => { d.decisionLog[i].decidedBy = e.target.value; })} /></Field>
                <Field label="Rationale" className="md:col-span-4"><In value={dl.rationale} onChange={(e) => update((d) => { d.decisionLog[i].rationale = e.target.value; })} /></Field>
              </div>
            </RepeaterItem>
          ))}
          <AddBtn onClick={() => update((d) => { d.decisionLog.push(blankDecision()); })} label="Add decision" />
        </div>
      </Section>

      {/* Sticky action bar. Deliberately `sticky`, not `fixed` — the layout's
          <main> has backdrop-blur, which (like transform/filter) creates a
          new containing block for fixed-position descendants, so a `fixed`
          bar here anchors to <main>'s box instead of the viewport and ends
          up stranded mid-page. `sticky bottom-0` pins correctly within the
          actual scrolling container instead. */}
      <div className="sticky bottom-0 z-20 -mx-5 border-t border-border bg-card/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {mode === "edit" && (
              <Button type="button" variant="outline" onClick={onDelete} disabled={deleting} className="text-destructive hover:text-destructive">
                <Trash2 size={14} /> Delete
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
          </div>
          <Button type="submit" disabled={pending}>
            <Save size={14} /> {pending ? "Saving…" : mode === "create" ? "Create Tracker" : "Save Changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
