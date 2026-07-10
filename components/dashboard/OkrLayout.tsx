"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  ChevronDown, Target, Zap, BarChart3, AlertTriangle,
  CheckCircle2, Eye, TrendingUp, ArrowRight,
} from "lucide-react";
import InsightVote from "@/components/trackers/InsightVote";

/* ─── Types ──────────────────────────────────────────────────────────────────── */

export type InsightSignal = "RISK" | "OPPORTUNITY" | "WATCH" | "ON_TRACK" | "NONE";

export interface MBInsight {
  /** DB id — undefined for static/demo data, which just can't be voted on. */
  id?: string;
  signal: InsightSignal;
  text: string;
  /** Optional category label from n8n API (e.g. "Capability", "GTM") */
  category?: string;
  upvotes?: number;
  downvotes?: number;
}

/** Formerly "MicroBattle" — now called Execution Tactic */
export interface ExecutionTactic {
  id: string;
  name: string;
  expectedOutcome: string;        // 1:1 paired expected outcome
  executionInsights: MBInsight[];
  outcomeInsights: MBInsight[];
}

/** Formerly "SubTheme" — now called MicroBattle */
export interface MicroBattle {
  id: string;
  name: string;
  executionTactics: ExecutionTactic[];
  /** MB-level insights from API (execution_insights) */
  executionInsights?: MBInsight[];
  /** MB-level insights from API (outcome_insights) */
  outcomeInsights?: MBInsight[];
}

// Legacy alias so BiopharmView static data still compiles without a full rename
export type SubTheme = MicroBattle & {
  /** @deprecated use executionTactics */
  microBattles?: ExecutionTactic[];
};

export interface StrategicOKR {
  id: string;
  title: string;
  integrationObjective: string;
  subThemes: MicroBattle[];
}

/* ─── Signal styles ──────────────────────────────────────────────────────────── */

const SIGNAL_STYLES: Record<InsightSignal, {
  badge: string; dot: string; icon: React.ElementType; label: string;
}> = {
  RISK:        { badge: "bg-red-100 text-red-700 border-red-200",             dot: "bg-red-500",     icon: AlertTriangle, label: "Risk"        },
  OPPORTUNITY: { badge: "bg-blue-100 text-blue-700 border-blue-200",          dot: "bg-blue-500",    icon: TrendingUp,    label: "Opportunity" },
  WATCH:       { badge: "bg-amber-100 text-amber-700 border-amber-200",       dot: "bg-amber-500",   icon: Eye,           label: "Watch"       },
  ON_TRACK:    { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", icon: CheckCircle2,  label: "On Track"    },
  NONE:        { badge: "bg-muted text-muted-foreground border-border",        dot: "bg-muted-foreground", icon: Eye,    label: ""            },
};

/* ─── Insight pill ───────────────────────────────────────────────────────────── */

function InsightPill({ insight, insightType, canVote }: { insight: MBInsight; insightType: "TACTIC_EXECUTION" | "TACTIC_OUTCOME"; canVote?: boolean }) {
  const signal = (insight.signal || "NONE") as InsightSignal;
  const s = SIGNAL_STYLES[signal] || SIGNAL_STYLES["NONE"];
  const Icon = s?.icon || Eye;
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <div className="flex items-start gap-2">
        <span className={cn("mt-[3px] w-1.5 h-1.5 rounded-full flex-shrink-0", s.dot)} />
        <span className="text-[11.5px] text-foreground leading-relaxed flex-1">{insight.text}</span>
        <div className="flex-shrink-0 flex items-center gap-1">
          {insight.category && (
            <span className="text-[9px] font-medium uppercase tracking-wide rounded-full px-1.5 py-0.5 border border-border bg-muted/50 text-muted-foreground">
              {insight.category}
            </span>
          )}
          {signal !== "NONE" && (
            <span className={cn("flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5 border", s.badge)}>
              <Icon size={9} aria-hidden="true" />
              {s.label}
            </span>
          )}
        </div>
      </div>
      {canVote && insight.id && (
        <div className="pl-3.5">
          <InsightVote insightType={insightType} insightId={insight.id} upvotes={insight.upvotes} downvotes={insight.downvotes} />
        </div>
      )}
    </div>
  );
}

/* ─── Insight section block ──────────────────────────────────────────────────── */

export function InsightSection({
  label, icon: Icon, iconColor, bgColor, borderColor, children,
}: {
  label: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border p-3 flex flex-col gap-0.5", bgColor, borderColor)}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className={iconColor} aria-hidden="true" />
        <span className={cn("text-[10px] font-bold uppercase tracking-widest", iconColor)}>{label}</span>
      </div>
      {children}
    </div>
  );
}

/* ─── Execution Tactic row ───────────────────────────────────────────────────── */

function ExecutionTacticRow({ tactic, index, hideOutcomes = false, canVote = false }: { tactic: ExecutionTactic; index: number; hideOutcomes?: boolean; canVote?: boolean }) {
  const allSignals  = [...tactic.executionInsights, ...tactic.outcomeInsights];
  const riskCount   = allSignals.filter(i => i.signal === "RISK").length;
  const watchCount  = allSignals.filter(i => i.signal === "WATCH").length;
  const onCount     = allSignals.filter(i => i.signal === "ON_TRACK").length;
  const hasInsights = allSignals.length > 0;

  return (
    <div className="border border-border rounded-xl overflow-hidden">

      {/* ── Tactic header ── */}
      <div className="w-full flex items-start gap-3 px-4 py-3 bg-card">
        <span className="flex-shrink-0 w-5 h-5 rounded bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Execution Tactic</p>
          <p className="text-[13px] font-semibold text-foreground leading-snug">{tactic.name}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          {riskCount  > 0 && <span className="text-[9px] font-bold bg-red-100 text-red-700 border border-red-200 rounded-full px-1.5 py-0.5">{riskCount}R</span>}
          {watchCount > 0 && <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5">{watchCount}W</span>}
          {onCount    > 0 && <span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-1.5 py-0.5">{onCount}G</span>}
        </div>
      </div>

      {/* ── Expected Outcome row — always visible unless hideOutcomes ── */}
      {!hideOutcomes && tactic.expectedOutcome && (
        <div className="px-4 py-2.5 bg-emerald-50/60 border-t border-emerald-100 flex items-start gap-2">
          <ArrowRight size={11} className="text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mr-1.5">Expected Outcome</span>
            <span className="text-[11.5px] text-emerald-800 leading-relaxed">{tactic.expectedOutcome}</span>
          </div>
        </div>
      )}

      {/* ── Linked insights: always visible ── */}
      {hasInsights && (
        <div className="border-t border-border bg-muted/10">

          {/* Execution Insights linked to this tactic */}
          {tactic.executionInsights.length > 0 && (
            <div className="flex items-stretch gap-0">
              <div className="flex flex-col items-center w-8 flex-shrink-0 py-3">
                <div className="w-px flex-1 bg-primary/25" />
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center my-1">
                  <Zap size={9} className="text-primary" aria-hidden="true" />
                </div>
                <div className="w-px flex-1 bg-primary/25" />
              </div>
              <div className="flex-1 py-2 pr-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-primary mb-1.5">Execution Insights</p>
                <div className="flex flex-col gap-0.5">
                  {tactic.executionInsights.map((ins, i) => <InsightPill key={ins.id ?? i} insight={ins} insightType="TACTIC_EXECUTION" canVote={canVote} />)}
                </div>
              </div>
            </div>
          )}

          {/* Arrow bridge between execution and outcome insights */}
          {!hideOutcomes && tactic.executionInsights.length > 0 && tactic.outcomeInsights.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-1.5 border-t border-dashed border-border/60">
              <div className="flex-1 h-px bg-gradient-to-r from-primary/20 via-emerald-400/40 to-emerald-600/20" />
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 flex-shrink-0">
                <ArrowRight size={9} className="text-emerald-600" aria-hidden="true" />
                <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-600">Outcome</span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-emerald-600/20 via-emerald-400/40 to-primary/20" />
            </div>
          )}

          {/* Outcome Insights linked to this tactic */}
          {!hideOutcomes && tactic.outcomeInsights.length > 0 && (
            <div className="flex items-stretch gap-0">
              <div className="flex flex-col items-center w-8 flex-shrink-0 py-3">
                <div className="w-px flex-1 bg-emerald-400/40" />
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center my-1">
                  <BarChart3 size={9} className="text-emerald-600" aria-hidden="true" />
                </div>
                <div className="w-px flex-1 bg-emerald-400/40" />
              </div>
              <div className="flex-1 py-2 pr-4">
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mb-1.5">Outcome Insights</p>
                <div className="flex flex-col gap-0.5">
                  {tactic.outcomeInsights.map((ins, i) => <InsightPill key={ins.id ?? i} insight={ins} insightType="TACTIC_OUTCOME" canVote={canVote} />)}
                </div>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

/* ─── Outcome Tactic row (Expected Outcome → Outcome Insights) ───────────────── */

export function OutcomeTacticRow({ tactic, index }: { tactic: ExecutionTactic; index: number }) {
  const hasInsights = tactic.outcomeInsights.length > 0;

  return (
    <div className="border border-border rounded-xl overflow-hidden">

      {/* ── Expected Outcome header ── */}
      <div className="w-full flex items-start gap-3 px-4 py-3 bg-card">
        <span className="flex-shrink-0 w-5 h-5 rounded bg-emerald-600/10 text-emerald-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-0.5">Expected Outcome</p>
          <p className="text-[13px] font-semibold text-foreground leading-snug">{tactic.expectedOutcome}</p>
        </div>
      </div>

      {/* ── Outcome Insights — always visible ── */}
      {hasInsights && (
        <div className="border-t border-border bg-muted/10">
          <div className="flex items-stretch gap-0">
            <div className="flex flex-col items-center w-8 flex-shrink-0 py-3">
              <div className="w-px flex-1 bg-emerald-400/40" />
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center my-1">
                <BarChart3 size={9} className="text-emerald-600" aria-hidden="true" />
              </div>
              <div className="w-px flex-1 bg-emerald-400/40" />
            </div>
            <div className="flex-1 py-2 pr-4">
              <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mb-1.5">Outcome Insights</p>
              <div className="flex flex-col gap-0.5">
                {tactic.outcomeInsights.map((ins, i) => <InsightPill key={ins.id ?? i} insight={ins} insightType="TACTIC_OUTCOME" />)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SubThemeSection({
  theme,
  open,
  onToggle,
  hideOutcomes = false,
  canVote = false,
}: {
  theme: SubTheme;
  open: boolean;
  onToggle: () => void;
  /** When true, hides the Expected Outcomes and Outcome Insights panels (V3 layout) */
  hideOutcomes?: boolean;
  canVote?: boolean;
}) {
  // Support both legacy `microBattles` and new `executionTactics`
  const tactics: ExecutionTactic[] = theme.executionTactics ?? (theme.microBattles as unknown as ExecutionTactic[]) ?? [];

  // Include both per-tactic insights AND MB-level insights (from API)
  const allSignals = [
    ...tactics.flatMap(t => [...t.executionInsights, ...t.outcomeInsights]),
    ...(theme.executionInsights ?? []),
    ...(theme.outcomeInsights   ?? []),
  ];
  const greenCount = allSignals.filter(i => i.signal === "ON_TRACK").length;
  const amberCount = allSignals.filter(i => i.signal === "WATCH").length;
  const redCount   = allSignals.filter(i => i.signal === "RISK").length;
  const hasAny     = greenCount + amberCount + redCount > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Micro-battle header */}
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-muted/60 border border-border hover:bg-muted transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Micro-Battle</p>
          <p className="text-[14px] font-bold text-foreground">{theme.name}</p>
        </div>
        {/* Insight signal count badges */}
        {hasAny && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {greenCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                {greenCount}
              </span>
            )}
            {amberCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                {amberCount}
              </span>
            )}
            {redCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                {redCount}
              </span>
            )}
          </div>
        )}
        <ChevronDown
          size={14}
          className={cn("text-muted-foreground transition-transform duration-200 flex-shrink-0", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="flex flex-col gap-2 pl-4 border-l-2 border-primary/20">

          {tactics.filter(t => t.name?.trim()).length === 0 ? (
            <p className="text-[12px] text-muted-foreground italic px-4 py-3">No execution tactics defined yet.</p>
          ) : (
            tactics
              .filter(t => t.name?.trim())
              .map((tactic, i) => (
                <ExecutionTacticRow
                  key={tactic.id}
                  tactic={tactic}
                  index={i}
                  hideOutcomes={hideOutcomes}
                  canVote={canVote}
                />
              ))
          )}

        </div>
      )}
    </div>
  );
}

/* ─── Strategic OKR block ──────────────────────────────────────────────����─────── */

function OKRBlock({ okr }: { okr: StrategicOKR }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full text-left flex items-start gap-3 group"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground flex-shrink-0 mt-0.5">
          <Target size={15} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Strategic OKR</p>
          <p className="text-[16px] font-bold text-foreground leading-snug">{okr.title}</p>
          {okr.integrationObjective && (
            <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug">{okr.integrationObjective}</p>
          )}
        </div>
        <ChevronDown
          size={16}
          className={cn("text-muted-foreground mt-2 transition-transform duration-200 flex-shrink-0 group-hover:text-foreground", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="flex flex-col gap-5 pl-11">
          {okr.subThemes.map(theme => (
            <SubThemeSection key={theme.id} theme={theme} open={false} onToggle={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main exported layout ───────────────────────────────────────────────────── */

export default function OkrPageLayout({ okrs }: { okrs: StrategicOKR[] }) {
  return (
    <div className="flex flex-col gap-8 max-w-full">
      {okrs.map((okr, i) => (
        <div key={okr.id}>
          <OKRBlock okr={okr} />
          {i < okrs.length - 1 && <div className="mt-8 border-t border-border" />}
        </div>
      ))}
    </div>
  );
}
