"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateInsights } from "@/app/actions/synthesis";
import { Sparkles, Loader2 } from "lucide-react";

export default function GenerateInsightsButton({ trackerId }: { trackerId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await generateInsights(trackerId);
      if (!res.ok) { toast.error(res.error); return; }
      const { suggestionCount, clarificationCount } = res.data;
      if (suggestionCount === 0 && clarificationCount === 0) {
        toast("Gemini ran but proposed nothing new — try again after more raw events land.");
      } else {
        const parts = [
          suggestionCount > 0 ? `${suggestionCount} insight suggestion${suggestionCount !== 1 ? "s" : ""} ready for review` : null,
          clarificationCount > 0 ? `${clarificationCount} clarifying question${clarificationCount !== 1 ? "s" : ""} sent automatically` : null,
        ].filter(Boolean);
        toast.success(parts.join(" · "));
        if (suggestionCount > 0) router.push(`/trackers/${trackerId}/review`);
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-60"
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
      {pending ? "Generating…" : "Generate Insights (AI)"}
    </button>
  );
}
