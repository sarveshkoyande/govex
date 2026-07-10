"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { voteInsight, type VotableInsightType } from "@/app/actions/insightFeedback";

// Shared across Strategy vs Outcome cards, Execution insights, and Outcome
// insights — the only difference between them is which insightType gets
// sent, everything else (upvote-is-one-click, downvote-requires-a-reason,
// note feeds lib/skillPatch.ts) is identical.
export default function InsightVote({
  insightType, insightId, upvotes = 0, downvotes = 0, dark = false,
}: {
  insightType: VotableInsightType;
  insightId: string;
  upvotes?: number;
  downvotes?: number;
  dark?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [showNoteBox, setShowNoteBox] = useState(false);
  const [note, setNote] = useState("");
  const [voted, setVoted] = useState<"UP" | "DOWN" | null>(null);

  function upvote() {
    startTransition(async () => {
      const res = await voteInsight(insightType, insightId, "UP");
      if (!res.ok) { toast.error(res.error); return; }
      setVoted("UP");
    });
  }
  function submitDownvote() {
    if (!note.trim()) { toast.error("A reason is required to downvote."); return; }
    startTransition(async () => {
      const res = await voteInsight(insightType, insightId, "DOWN", note.trim());
      if (!res.ok) { toast.error(res.error); return; }
      setVoted("DOWN");
      setShowNoteBox(false);
      toast.success("Thanks — drafting a skill improvement from this in the background for admin review.");
    });
  }

  const dimClass = dark ? "text-white/40 hover:text-white/70" : "text-muted-foreground hover:text-foreground";

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={upvote}
          disabled={pending || voted !== null}
          className={`flex items-center gap-1 text-[10px] font-semibold ${voted === "UP" ? "text-emerald-500" : dimClass}`}
        >
          {pending && voted === null ? <Loader2 size={11} className="animate-spin" /> : <ThumbsUp size={11} />} {upvotes}
        </button>
        <button
          type="button"
          onClick={() => setShowNoteBox((v) => !v)}
          disabled={pending || voted !== null}
          className={`flex items-center gap-1 text-[10px] font-semibold ${voted === "DOWN" ? "text-red-500" : dimClass}`}
        >
          <ThumbsDown size={11} /> {downvotes}
        </button>
      </div>
      {showNoteBox && voted === null && (
        <div className="flex flex-col gap-1.5">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why is this insight wrong or unhelpful? (required)"
            className={
              dark
                ? "min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-[10px] text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/30"
                : "min-h-[44px] rounded-lg border border-border bg-background px-2 py-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            }
          />
          <button
            type="button"
            onClick={submitDownvote}
            disabled={pending}
            className={dark ? "w-fit rounded-md bg-white/10 px-2.5 py-1 text-[9px] font-semibold text-white hover:bg-white/20" : "w-fit rounded-md bg-muted px-2.5 py-1 text-[9px] font-semibold text-foreground hover:bg-muted/70"}
          >
            Submit feedback
          </button>
        </div>
      )}
    </div>
  );
}
