"use client";

import { useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import { SubThemeSection, type MicroBattle } from "@/components/dashboard/OkrLayout";
import { OkrCarousel } from "@/components/dashboard/OkrCarousel";
import InsightVote from "@/components/trackers/InsightVote";

export interface OkrCard { id: string; title: string; metrics?: string; tags?: string[] }
export interface StrategyInsightCard { id: string; title: string; description: string; upvotes?: number; downvotes?: number }

export interface ThemeData {
  goals: string[];
  okrs: OkrCard[];
  microBattles: MicroBattle[];
  strategyInsights: StrategyInsightCard[];
}

/* ─── Outcomes card per micro-battle (ported from the sample BiopharmViewV2) ─── */
function MicroBattleOutcomeCard({ mb, canVote = false }: { mb: MicroBattle; canVote?: boolean }) {
  const [open, setOpen] = useState(false);
  const tactics = mb.executionTactics ?? [];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <p className="text-[14px] font-bold text-foreground">{mb.name}</p>
        <svg width="16" height="16" viewBox="0 0 12 12" fill="none" className={`flex-shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="M2 4.5L6 8L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="mx-3 mb-3 mt-0 overflow-hidden rounded-xl border border-border">
          {tactics.map((tactic, i) => (
            <div key={tactic.id} className={`flex flex-col ${i < tactics.length - 1 ? "border-b border-border" : ""}`}>
              <div className="flex items-start gap-3 bg-card px-4 py-3.5">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">Expected Outcome</span>
                  <p className="text-[13px] font-semibold leading-snug text-foreground">
                    {tactic.expectedOutcome?.trim() || <span className="font-normal italic text-muted-foreground">No outcome defined</span>}
                  </p>
                </div>
              </div>
              {(tactic.outcomeInsights?.length ?? 0) > 0 && (
                <div className="flex items-start gap-3 border-t border-border/60 bg-muted/30 px-4 py-3">
                  <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                    <BarChart3 size={10} className="text-emerald-600" aria-hidden="true" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600">Outcome Insights</span>
                    <ul className="mt-0.5 flex flex-col gap-1">
                      {tactic.outcomeInsights.map((ins, j) => (
                        <li key={ins.id ?? j} className="flex flex-col gap-0.5">
                          <div className="flex items-start gap-2">
                            <span className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-foreground/30" />
                            <span className="text-[12px] leading-relaxed text-foreground/80">{ins.text}</span>
                          </div>
                          {canVote && ins.id && (
                            <div className="pl-3.5">
                              <InsightVote insightType="TACTIC_OUTCOME" insightId={ins.id} upvotes={ins.upvotes} downvotes={ins.downvotes} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          ))}
          {tactics.length === 0 && <p className="px-4 py-3 text-[12px] italic text-muted-foreground">No expected outcomes defined yet.</p>}
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: "strategy", label: "Strategy", icon: (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>) },
  { id: "execution", label: "Execution", icon: (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>) },
  { id: "outcomes", label: "Outcomes", icon: (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>) },
  { id: "strategy-vs-outcome", label: "Strategy vs Outcome", icon: (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>) },
] as const;

export default function ThemeTabs({ data, canVote = false }: { data: ThemeData; canVote?: boolean }) {
  const [active, setActive] = useState<string>("strategy");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      {/* Tab bar (replicates the sample) */}
      <div className="rounded-xl border border-border bg-card px-3 py-2.5">
        <div className="flex items-center gap-1">
          {TABS.map((tab, i) => {
            const isActive = active === tab.id;
            return (
              <div key={tab.id} className="flex min-w-0 flex-1 items-center gap-1">
                <button
                  onClick={() => setActive(tab.id)}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2 transition-all duration-150 ${isActive ? "border border-primary/25 bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}
                >
                  <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${isActive ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}`}>{tab.icon}</span>
                  <span className={`truncate whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.1em] ${isActive ? "text-primary" : ""}`}>{tab.label}</span>
                </button>
                {i < TABS.length - 1 && (
                  <svg width="6" height="10" viewBox="0 0 6 10" fill="none" className="flex-shrink-0 text-border opacity-60">
                    <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Strategy */}
      {active === "strategy" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-primary">Integration Hypothesis &amp; Objective</p>
            {data.goals.length === 0 ? (
              <p className="text-[12px] italic text-muted-foreground">No strategic goals defined yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data.goals.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                    <p className="text-[13px] font-semibold leading-snug text-foreground">{item}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="mb-3 px-0.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">All OKRs</p>
            {data.okrs.length === 0 ? (
              <p className="px-0.5 text-[12px] italic text-muted-foreground">No OKRs defined yet.</p>
            ) : (
              <OkrCarousel okrs={data.okrs} />
            )}
          </div>
        </div>
      )}

      {/* Execution */}
      {active === "execution" && (
        <div className="flex flex-col gap-3">
          <p className="px-0.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Micro-Battles</p>
          {data.microBattles.length === 0 ? (
            <p className="px-0.5 text-[12px] italic text-muted-foreground">No micro-battles defined yet.</p>
          ) : (
            data.microBattles.map((mb) => (
              <SubThemeSection key={mb.id} theme={mb} open={expandedId === mb.id} onToggle={() => setExpandedId((p) => (p === mb.id ? null : mb.id))} hideOutcomes canVote={canVote} />
            ))
          )}
        </div>
      )}

      {/* Outcomes */}
      {active === "outcomes" && (
        <div className="flex flex-col gap-3">
          <p className="px-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Micro-Battle Outcomes</p>
          {data.microBattles.length === 0 ? (
            <p className="px-0.5 text-[12px] italic text-muted-foreground">No micro-battles defined yet.</p>
          ) : (
            data.microBattles.map((mb) => <MicroBattleOutcomeCard key={mb.id} mb={mb} canVote={canVote} />)
          )}
        </div>
      )}

      {/* Strategy vs Outcome */}
      {active === "strategy-vs-outcome" && (
        <div className="flex flex-col gap-3">
          <p className="px-0.5 text-[11px] text-muted-foreground">Strategic insights and collation across all micro-battles</p>
          {data.strategyInsights.length === 0 ? (
            <p className="px-0.5 text-[12px] italic text-muted-foreground">No strategy-vs-outcome insights defined yet.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl" style={{ background: "linear-gradient(160deg, #0b1535 0%, #0d1a3a 60%, #0a1228 100%)" }}>
              <div className="flex items-center gap-4 border-b border-white/10 px-6 py-5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <TrendingUp size={16} className="text-white" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-white">Strategic Insights</p>
                  <p className="mt-0.5 text-[12px] text-white/45">Strategic implications and collations across the theme</p>
                </div>
              </div>
              {data.strategyInsights.map((item, i) => (
                <div key={item.id} className={`flex items-start gap-5 px-6 py-5 ${i < data.strategyInsights.length - 1 ? "border-b border-white/8" : ""}`}>
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white/60">{i + 1}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-[13.5px] font-bold leading-snug text-white">{item.title}</p>
                    {item.description && <p className="text-[12px] leading-relaxed text-white/55">{item.description}</p>}
                    {canVote && <InsightVote insightType="STRATEGY" insightId={item.id} upvotes={item.upvotes ?? 0} downvotes={item.downvotes ?? 0} dark />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
