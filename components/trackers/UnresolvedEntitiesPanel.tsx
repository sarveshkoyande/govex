"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, FolderPlus, Tag, Ban, ChevronDown, ChevronUp } from "lucide-react";
import { promoteEntityCandidate, dismissEntityCandidate } from "@/app/actions/unresolvedEntities";
import { cn } from "@/lib/utils";
import type { PromotableEntityCandidate } from "@/lib/entityExtraction";

const TYPE_LABEL: Record<PromotableEntityCandidate["entityType"], string> = {
  PERSON: "Person",
  PROJECT: "Project",
  OTHER: "Other",
};

const PROMOTE_LABEL: Record<PromotableEntityCandidate["entityType"], string> = {
  PERSON: "Add as Stakeholder",
  PROJECT: "Add as Workstream",
  OTHER: "Add to Glossary",
};

const PROMOTE_ICON: Record<PromotableEntityCandidate["entityType"], typeof UserPlus> = {
  PERSON: UserPlus,
  PROJECT: FolderPlus,
  OTHER: Tag,
};

function CandidateRow({ trackerId, candidate, onResolved }: { trackerId: string; candidate: PromotableEntityCandidate; onResolved: (term: string) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const PromoteIcon = PROMOTE_ICON[candidate.entityType];

  function promote() {
    startTransition(async () => {
      const res = await promoteEntityCandidate(trackerId, candidate.term, candidate.entityType);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${PROMOTE_LABEL[candidate.entityType]}: "${candidate.term}".`);
      onResolved(candidate.term);
      // The promotion is a real new Stakeholder/MicroBattle/OrgTerm row —
      // other parts of this page (the graph, stakeholder list, workstream
      // list) are server-rendered and won't pick it up without this.
      router.refresh();
    });
  }
  function dismiss() {
    startTransition(async () => {
      const res = await dismissEntityCandidate(trackerId, candidate.term);
      if (!res.ok) { toast.error(res.error); return; }
      onResolved(candidate.term);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{candidate.term}</span>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
            {TYPE_LABEL[candidate.entityType]}
          </span>
          <span className="text-[10px] text-muted-foreground">{candidate.occurrences}× mentioned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={promote}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/15 disabled:opacity-60"
          >
            <PromoteIcon size={11} /> {PROMOTE_LABEL[candidate.entityType]}
          </button>
          <button
            type="button"
            onClick={dismiss}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
          >
            <Ban size={11} /> Dismiss
          </button>
        </div>
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">{candidate.sampleSnippet}</p>
    </div>
  );
}

export default function UnresolvedEntitiesPanel({ trackerId, initial }: { trackerId: string; initial: PromotableEntityCandidate[] }) {
  const [candidates, setCandidates] = useState(initial);
  const [open, setOpen] = useState(false);

  if (candidates.length === 0) return null;

  function onResolved(term: string) {
    setCandidates((prev) => prev.filter((c) => c.term !== term));
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center justify-between text-left">
        <p className="text-xs font-bold text-amber-900">
          {candidates.length} name{candidates.length !== 1 ? "s" : ""}/project{candidates.length !== 1 ? "s" : ""} mentioned repeatedly, not yet tracked
        </p>
        {open ? <ChevronUp size={14} className="text-amber-700" /> : <ChevronDown size={14} className="text-amber-700" />}
      </button>
      {open && (
        <div className={cn("flex flex-col gap-2 pt-1")}>
          {candidates.map((c) => (
            <CandidateRow key={c.term} trackerId={trackerId} candidate={c} onResolved={onResolved} />
          ))}
        </div>
      )}
    </div>
  );
}
