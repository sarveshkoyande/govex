"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { approveSkillPatch, rejectSkillPatch, setAutoApproveSkillPatches } from "@/app/actions/skillPatches";
import { draftSkill } from "@/app/actions/skillAuthoring";
import { ChevronDown, Check, X, Sparkles, Loader2, PlusCircle } from "lucide-react";

export interface SkillPatchView {
  id: string;
  skillName: string;
  currentContent: string;
  proposedContent: string;
  reasoning: string;
  createdAt: string;
  isNewSkill: boolean;
  newSkillTitle: string | null;
}

function PatchCard({ patch, onResolved }: { patch: SkillPatchView; onResolved: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const noOp = !patch.isNewSkill && patch.proposedContent.trim() === patch.currentContent.trim();

  function approve() {
    startTransition(async () => {
      const res = await approveSkillPatch(patch.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(patch.isNewSkill ? `Created skill "${patch.skillName}".` : `Applied patch to ${patch.skillName}.md`);
      onResolved(patch.id);
    });
  }
  function reject() {
    startTransition(async () => {
      const res = await rejectSkillPatch(patch.id);
      if (!res.ok) { toast.error(res.error); return; }
      onResolved(patch.id);
    });
  }

  const heading = patch.isNewSkill
    ? `New skill: ${patch.newSkillTitle ?? patch.skillName}`
    : noOp
      ? "Recommendation: needs a new skill"
      : `Proposed patch to ${patch.skillName}.md`;

  return (
    <div className="overflow-hidden rounded-xl border border-amber-300/50 bg-amber-50/40">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-amber-50/70">
        {patch.isNewSkill ? <PlusCircle size={13} className="flex-shrink-0 text-amber-600" /> : <Sparkles size={13} className="flex-shrink-0 text-amber-600" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{heading}</p>
          <p className="truncate text-[11px] text-muted-foreground">{patch.reasoning}</p>
        </div>
        <ChevronDown size={14} className={cn("flex-shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-amber-300/50 p-4">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reasoning</p>
            <p className="text-[12px] leading-relaxed text-foreground">{patch.reasoning}</p>
          </div>
          {patch.isNewSkill ? (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600">Content</p>
              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 font-mono text-[10px] leading-relaxed text-foreground/80">{patch.proposedContent}</pre>
            </div>
          ) : !noOp && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current</p>
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 font-mono text-[10px] leading-relaxed text-foreground/80">{patch.currentContent}</pre>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-emerald-600">Proposed</p>
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 font-mono text-[10px] leading-relaxed text-foreground/80">{patch.proposedContent}</pre>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            {(patch.isNewSkill || !noOp) && (
              <Button size="sm" onClick={approve} disabled={pending}><Check size={12} /> {patch.isNewSkill ? "Approve & create" : "Approve & apply"}</Button>
            )}
            <Button size="sm" variant="outline" onClick={reject} disabled={pending}><X size={12} /> {noOp ? "Dismiss" : "Reject"}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Free-text "describe a skill" box — lib/skillAuthoring.ts decides whether
// this extends an existing skill or needs a brand-new one, drafts it, and
// the result lands in the same pending-patches list below (or applies
// immediately if auto-approve is on).
function SkillEditor({ onDrafted }: { onDrafted: () => void }) {
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!description.trim()) { toast.error("Describe what you want the skill to do."); return; }
    startTransition(async () => {
      const res = await draftSkill(description.trim());
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(res.data.autoApplied ? "Skill drafted and applied automatically." : "Skill drafted — review it below.");
      setDescription("");
      onDrafted();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-primary">
        <PlusCircle size={12} /> Describe a skill
      </p>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. 'I want something that checks whether a stakeholder is overloaded relative to what they own' — it'll decide whether to extend an existing skill or draft a new one."
        className="min-h-[60px] rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Draft
        </Button>
      </div>
    </div>
  );
}

export default function SkillPatchesPanel({ patches, autoApprove }: { patches: SkillPatchView[]; autoApprove: boolean }) {
  const [list, setList] = useState(patches);
  const [auto, setAuto] = useState(autoApprove);
  const [pending, startTransition] = useTransition();

  function toggleAuto() {
    const next = !auto;
    setAuto(next);
    startTransition(async () => {
      const res = await setAutoApproveSkillPatches(next);
      if (!res.ok) { toast.error(res.error); setAuto(!next); return; }
      toast.success(next ? "Skill patches now apply automatically." : "Skill patches now require your approval.");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-bold text-foreground">Auto-approve skill patches</p>
          <p className="text-[11px] text-muted-foreground">When on, a drafted patch or new skill applies immediately — no review step.</p>
        </div>
        <button
          type="button"
          onClick={toggleAuto}
          disabled={pending}
          className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors"
          style={{ background: auto ? "oklch(0.46 0.19 258)" : "oklch(0.82 0.01 255)" }}
          aria-pressed={auto}
        >
          <span
            className="absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: auto ? "translateX(20px)" : "translateX(2px)" }}
          />
        </button>
      </div>

      <SkillEditor onDrafted={() => window.location.reload()} />

      {list.length === 0 ? (
        <p className="px-0.5 text-[12px] italic text-muted-foreground">No pending skill patches — downvote an insight with a reason, or describe a skill above.</p>
      ) : (
        list.map((p) => <PatchCard key={p.id} patch={p} onResolved={(id) => setList((prev) => prev.filter((x) => x.id !== id))} />)
      )}
    </div>
  );
}
