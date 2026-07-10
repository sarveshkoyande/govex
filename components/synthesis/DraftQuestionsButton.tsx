"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { generateQuestions } from "@/app/actions/questions";
import { HelpCircle, Loader2 } from "lucide-react";

export default function DraftQuestionsButton({ trackerId }: { trackerId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const res = await generateQuestions(trackerId);
      if (!res.ok) { toast.error(res.error); return; }
      if (res.data.questionCount === 0) {
        toast("No new gaps found — nothing to ask right now.");
      } else {
        toast.success(`${res.data.questionCount} question${res.data.questionCount !== 1 ? "s" : ""} drafted and sent automatically.`);
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-60"
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : <HelpCircle size={13} />}
      {pending ? "Scanning…" : "Draft Questions (AI)"}
    </button>
  );
}
