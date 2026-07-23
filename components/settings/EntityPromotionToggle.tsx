"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setAutoPromoteEntities } from "@/app/actions/entityPromotion";

export default function EntityPromotionToggle({ initial }: { initial: boolean }) {
  const [auto, setAuto] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !auto;
    setAuto(next);
    startTransition(async () => {
      const res = await setAutoPromoteEntities(next);
      if (!res.ok) { toast.error(res.error); setAuto(!next); return; }
      toast.success(next ? "Entity candidates now promote automatically." : "Entity candidates now require review in the tracker panel.");
    });
  }

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
      <div>
        <p className="text-sm font-bold text-foreground">Auto-promote entity candidates</p>
        <p className="text-[11px] text-muted-foreground">
          When on (default), a recurring name/project/term is created automatically once it's mentioned enough times —
          no review step. When off, candidates only ever appear in each tracker&apos;s Unresolved Entities panel for a
          human to confirm or dismiss.
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
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
  );
}
