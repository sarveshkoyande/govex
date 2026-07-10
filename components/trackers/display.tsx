import { cn } from "@/lib/utils";
import { AlertTriangle, Eye, CheckCircle2, TrendingUp, Gauge } from "lucide-react";

/* Signal taxonomy pill — matches the sample HomeView styling. */
const SIGNAL_CFG: Record<string, { label: string; icon: React.ElementType; pill: string; dot: string }> = {
  RISK:        { label: "Risk",        icon: AlertTriangle, pill: "bg-red-50 text-red-600 ring-1 ring-red-200",           dot: "bg-red-500" },
  WATCH:       { label: "Watch",       icon: Eye,           pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",      dot: "bg-amber-500" },
  ON_TRACK:    { label: "On Track",    icon: CheckCircle2,  pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", dot: "bg-emerald-500" },
  OPPORTUNITY: { label: "Opportunity", icon: TrendingUp,    pill: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",         dot: "bg-blue-500" },
};

export function SignalPill({ signal, className }: { signal: string; className?: string }) {
  const cfg = SIGNAL_CFG[signal] ?? SIGNAL_CFG.ON_TRACK;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5", cfg.pill, className)}>
      <Icon size={10} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

export function SignalDot({ signal }: { signal: string }) {
  const cfg = SIGNAL_CFG[signal] ?? SIGNAL_CFG.ON_TRACK;
  return <span className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} aria-hidden="true" />;
}

const RAG_CFG: Record<string, string> = {
  RED:   "bg-red-50 text-red-600 ring-1 ring-red-200",
  AMBER: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  GREEN: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
};

export function RagBadge({ rag }: { rag: string }) {
  return (
    <span className={cn("inline-flex items-center text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5", RAG_CFG[rag] ?? RAG_CFG.GREEN)}>
      {rag}
    </span>
  );
}

/* Per-field confidence badge — the philosophy's signature metadata. */
export function ConfidenceBadge({ value, className }: { value: number; className?: string }) {
  const tone =
    value >= 75 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" :
    value >= 50 ? "bg-amber-50 text-amber-700 ring-amber-200" :
                  "bg-red-50 text-red-600 ring-red-200";
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-1.5 py-0.5 ring-1", tone, className)}
      title="Confidence score for this field"
    >
      <Gauge size={9} aria-hidden="true" />
      {value}%
    </span>
  );
}
