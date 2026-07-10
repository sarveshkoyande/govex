"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INGESTION_SOURCE } from "@/lib/enums";
import { Send, CheckCircle2, KeyRound } from "lucide-react";

const inputCls = "w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function IngestTestForm({
  trackerId, trackerName, askedQuestions = [],
}: {
  trackerId: string;
  trackerName: string;
  askedQuestions?: { id: string; questionText: string }[];
}) {
  const [token, setToken] = useState("");
  const [source, setSource] = useState<(typeof INGESTION_SOURCE)[number]>("EMAIL");
  const [sourceSystem, setSourceSystem] = useState("manual-test");
  const [subject, setSubject] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [participants, setParticipants] = useState("");
  const [rawText, setRawText] = useState("");
  const [answersQuestionId, setAnswersQuestionId] = useState("");
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ eventId: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return toast.error("Paste an ingestion API token first (Settings → Ingestion Keys).");
    if (!rawText.trim()) return toast.error("Raw text is required.");

    setSending(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token.trim()}` },
        body: JSON.stringify({
          trackerId,
          source,
          sourceSystem: sourceSystem.trim() || "manual-test",
          subject: subject.trim() || undefined,
          fromAddress: fromAddress.trim() || undefined,
          participants: participants.trim() || undefined,
          rawText: rawText.trim(),
          answersQuestionId: answersQuestionId || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        toast.error(body.error ?? `Request failed (${res.status})`);
        return;
      }
      setLastResult({ eventId: body.eventId });
      toast.success(answersQuestionId ? "Event ingested — question marked Answered." : "Event ingested — check the tracker's Raw Ingestion Events card.");
      setSubject("");
      setRawText("");
      setAnswersQuestionId("");
    } catch {
      toast.error("Network error calling /api/ingest.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <Label htmlFor="token" className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <KeyRound size={11} /> Ingestion API token
        </Label>
        <Input id="token" placeholder="govex_ingest_…" value={token} onChange={(e) => setToken(e.target.value)} className="font-mono" />
        <p className="text-[10px] text-muted-foreground">
          Mint one at <Link href="/settings/ingestion-keys" className="underline">Ingestion Keys</Link> (System Admin only).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source</span>
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className={inputCls}>
            {INGESTION_SOURCE.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Source system</span>
          <Input value={sourceSystem} onChange={(e) => setSourceSystem(e.target.value)} placeholder="outlook / teams / manual-test" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Subject</span>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Weekly sync notes" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">From / organizer</span>
          <Input value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} placeholder="jay.khan@indegene.com" />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Participants</span>
          <Input value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="Vivek Ghai, Jay Khan, Steve Carickhoff" />
        </div>
        {askedQuestions.length > 0 && (
          <div className="col-span-2 flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Answers question (optional — Stage 3)</span>
            <select value={answersQuestionId} onChange={(e) => setAnswersQuestionId(e.target.value)} className={inputCls}>
              <option value="">— none —</option>
              {askedQuestions.map((q) => <option key={q.id} value={q.id}>{q.questionText.slice(0, 80)}</option>)}
            </select>
          </div>
        )}
        <div className="col-span-2 flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Raw text *</span>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste the email body or meeting notes/transcript…"
            className={cn(inputCls, "min-h-[140px] resize-y")}
          />
        </div>
      </div>

      {lastResult && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
          <CheckCircle2 size={14} /> Stored as event {lastResult.eventId.slice(0, 10)}… for {trackerName}
        </div>
      )}

      <Button type="submit" disabled={sending} className="self-start">
        <Send size={14} /> {sending ? "Sending…" : "Send to /api/ingest"}
      </Button>
    </form>
  );
}
