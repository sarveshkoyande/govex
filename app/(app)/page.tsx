import Link from "next/link";
import { getSessionUser } from "@/lib/rbac";
import { canWrite } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";
import { SignalPill, SignalDot, RagBadge, ConfidenceBadge } from "@/components/trackers/display";
import {
  Sparkles, Activity, Plus, ArrowUpRight, AlertTriangle, Eye, CheckCircle2, TrendingUp, Layers,
} from "lucide-react";

const SIGNALS = ["RISK", "WATCH", "ON_TRACK", "OPPORTUNITY"] as const;
const SIGNAL_META = {
  RISK: { label: "Risk", icon: AlertTriangle, accent: "bg-red-500", text: "text-red-600" },
  WATCH: { label: "Watch", icon: Eye, accent: "bg-amber-500", text: "text-amber-600" },
  ON_TRACK: { label: "On Track", icon: CheckCircle2, accent: "bg-emerald-500", text: "text-emerald-600" },
  OPPORTUNITY: { label: "Opportunity", icon: TrendingUp, accent: "bg-blue-500", text: "text-blue-600" },
} as const;

function fmtMoney(v: number | null, currency: string) {
  if (v == null) return "—";
  return `${currency === "USD" ? "$" : ""}${v}M`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const user = await getSessionUser();
  const { domain: domainSlug } = await searchParams;

  const domain = domainSlug
    ? await prisma.domain.findFirst({ where: { orgId: user!.orgId, slug: domainSlug } })
    : null;

  const trackers = await prisma.tracker.findMany({
    where: { orgId: user!.orgId, ...(domain ? { domainId: domain.id } : {}) },
    orderBy: { updatedAt: "desc" },
    include: {
      domain: { select: { name: true } },
      _count: { select: { risks: true, nextActions: true, microBattles: true, stakeholders: true } },
    },
  });

  const counts = SIGNALS.reduce(
    (acc, s) => ({ ...acc, [s]: trackers.filter((t) => t.signalStatus === s).length }),
    {} as Record<string, number>,
  );
  const total = trackers.length;
  const totalRisks = trackers.reduce((n, t) => n + t._count.risks, 0);
  const writable = canWrite(user!.role);

  return (
    <div className="flex flex-col gap-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" aria-hidden="true" />
            <h1 className="text-balance text-xl font-extrabold tracking-tight text-foreground">
              {domain ? domain.name : "Executive Intelligence"}
            </h1>
          </div>
          <p className="text-[12px] text-muted-foreground">
            {total} tracker{total !== 1 ? "s" : ""}
            {domain ? " in this domain" : " across all themes"}
            {totalRisks > 0 && ` · ${totalRisks} open risk${totalRisks !== 1 ? "s" : ""}`}
          </p>
        </div>
        {writable && (
          <Link
            href="/trackers/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus size={14} />
            New Tracker
          </Link>
        )}
      </div>

      {/* Portfolio health bar + signal summary */}
      {total > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <Activity size={10} /> Portfolio health
            </p>
            <div className="flex h-2 gap-px overflow-hidden rounded-full">
              {SIGNALS.map((s) => {
                const pct = (counts[s] / total) * 100;
                if (!pct) return null;
                return <div key={s} className={cn("h-full", SIGNAL_META[s].accent)} style={{ width: `${pct}%` }} title={`${SIGNAL_META[s].label}: ${counts[s]}`} />;
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SIGNALS.map((s) => {
              const cfg = SIGNAL_META[s];
              const Icon = cfg.icon;
              const pct = total ? Math.round((counts[s] / total) * 100) : 0;
              return (
                <div key={s} className="relative flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-4">
                  <div className={cn("absolute inset-x-0 top-0 h-[3px]", cfg.accent)} />
                  <div className="flex items-center justify-between">
                    <Icon size={14} className={cfg.text} aria-hidden="true" />
                    <span className={cn("text-[9px] font-bold uppercase tracking-widest", cfg.text)}>{cfg.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className={cn("text-3xl font-extrabold leading-none tabular-nums", cfg.text)}>{counts[s]}</span>
                    <span className="text-[10px] text-muted-foreground">trackers</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{pct}% of portfolio</p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Tracker cards */}
      {total === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <Layers size={28} className="text-muted-foreground/50" />
          <p className="text-sm font-semibold text-foreground">No trackers yet</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {writable ? "Create your first theme/tracker to populate the executive view." : "No trackers have been created for this scope."}
          </p>
          {writable && (
            <Link href="/trackers/new" className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
              <Plus size={14} /> New Tracker
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {trackers.map((t) => (
            <Link
              key={t.id}
              href={`/trackers/${t.id}`}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:border-border/80 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <SignalDot signal={t.signalStatus} />
                  <h3 className="text-sm font-bold leading-tight text-foreground">{t.name}</h3>
                </div>
                <ArrowUpRight size={14} className="flex-shrink-0 text-muted-foreground" />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{t.domain.name}</span>
                <SignalPill signal={t.signalStatus} />
                <RagBadge rag={t.ragStatus} />
                <ConfidenceBadge value={t.overallConfidence} />
              </div>

              {t.description && <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{t.description}</p>}

              {/* Financial snapshot */}
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2.5">
                {[
                  { k: "Budget", v: t.budget },
                  { k: "Spend", v: t.spend },
                  { k: "Forecast", v: t.forecast },
                ].map(({ k, v }) => (
                  <div key={k} className="flex flex-col">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</span>
                    <span className="text-xs font-bold tabular-nums text-foreground">{fmtMoney(v, t.currency)}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>{t._count.microBattles} micro-battles</span>
                <span>·</span>
                <span>{t._count.risks} risks</span>
                <span>·</span>
                <span>{t._count.nextActions} actions</span>
                {t.ownerName && (
                  <>
                    <span>·</span>
                    <span>Owner: {t.ownerName}</span>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
