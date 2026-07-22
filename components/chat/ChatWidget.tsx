"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  getOrCreateActiveSession, startNewSession, confirmProposal, rejectProposal,
  type ChatMessageView,
} from "@/app/actions/chat";
import type { StreamEvent } from "@/lib/agent";
import { frameworkOutputSchema, type FrameworkOutput } from "@/lib/validation/framework";
import { MessageCircle, X, Send, Loader2, Check, Ban, Sparkles, Plus, Brain, ChevronRight, LayoutGrid, TriangleAlert } from "lucide-react";

// Assistant replies come back as markdown (bold, bullets) — render them
// properly instead of dumping raw asterisks. Kept to a minimal element set
// since these are compact chat bubbles, not full documents.
function MarkdownBubble({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("prose-chat text-xs leading-relaxed", className)}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-1.5 list-disc pl-4 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-1.5 list-decimal pl-4 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="mb-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          code: ({ children }) => <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[11px]">{children}</code>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// Collapsed by default (shows just the first line as a preview) — click to
// expand the full step. Keeps a multi-step orchestration trace scannable
// instead of a wall of italic text pushing the actual answer off-screen.
function ReasoningBubble({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const firstLine = content.replace(/\*\*/g, "").split("\n").find((l) => l.trim())?.trim() ?? "Reasoning step";

  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="flex w-full items-start gap-1.5 rounded-lg bg-muted/30 px-2.5 py-1.5 text-left text-muted-foreground hover:bg-muted/50"
    >
      <Brain size={11} className="mt-0.5 flex-shrink-0" />
      {open ? (
        <MarkdownBubble content={content} className="text-[10px] italic" />
      ) : (
        <span className="min-w-0 flex-1 truncate text-[10px] italic">{firstLine}</span>
      )}
      <ChevronRight size={11} className={cn("mt-0.5 flex-shrink-0 transition-transform", open && "rotate-90")} />
    </button>
  );
}

// statusTone -> color. "risk"/"negative" both read as warm/urgent but at two
// intensities (amber vs red) so a framework's AT-RISK and outright-failing
// calls stay visually distinct at a glance.
const TONE_STYLES: Record<FrameworkOutput["elements"][number]["statusTone"], string> = {
  positive: "bg-emerald-100 text-emerald-700 border-emerald-200",
  risk: "bg-amber-100 text-amber-700 border-amber-200",
  negative: "bg-red-100 text-red-700 border-red-200",
  neutral: "bg-muted text-muted-foreground border-border",
};

// The structured, per-element card that's the actual proof a framework skill
// walked every element it defines — rather than trusting prose that merely
// sounds like it did. See lib/agentTools.ts applySkillTool / lib/validation/framework.ts.
function FrameworkCard({ output, skillApplied }: { output: FrameworkOutput; skillApplied?: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-primary">
        <LayoutGrid size={11} /> {output.frameworkName}
      </p>
      <div className="flex flex-col gap-1.5">
        {output.elements.map((el, i) => (
          <div key={i} className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">{el.name}</span>
              <span className={cn("shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide", TONE_STYLES[el.statusTone])}>
                {el.statusLabel}
              </span>
            </div>
            <p className="text-[11px] leading-snug text-muted-foreground">{el.evidence}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg bg-primary/[0.06] px-2.5 py-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">So what</p>
        <p className="text-xs leading-snug text-foreground">{output.soWhat}</p>
      </div>
      {skillApplied && <p className="text-right text-[9px] text-muted-foreground">via {skillApplied}</p>}
    </div>
  );
}

// Fallback when a framework skill's structured JSON failed zod validation —
// visually distinct (amber, flagged) from FrameworkCard so it's never
// mistaken for the verified per-element breakdown.
function UnstructuredFrameworkCard({ analysis, skillApplied }: { analysis: string; skillApplied?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
        <TriangleAlert size={11} /> {skillApplied ?? "Framework"} — unstructured fallback
      </p>
      <MarkdownBubble content={analysis} />
    </div>
  );
}

// Tries to read a framework-skill tool result out of a "tool" message's
// toolResult JSON. Returns null for every other tool call (search_trackers,
// get_tracker_details, non-framework apply_skill, propose_*, etc.), which
// keeps rendering as the generic Fetched line.
function parseFrameworkResult(toolResult: string | null): { framework?: FrameworkOutput; analysis?: string; skillApplied?: string; structuredOutputFailed?: boolean } | null {
  if (!toolResult) return null;
  try {
    const parsed = JSON.parse(toolResult);
    if (parsed?.framework) {
      const result = frameworkOutputSchema.safeParse(parsed.framework);
      if (result.success) return { framework: result.data, skillApplied: parsed.skillApplied };
    }
    if (parsed?.structuredOutputFailed && typeof parsed.analysis === "string") {
      return { analysis: parsed.analysis, skillApplied: parsed.skillApplied, structuredOutputFailed: true };
    }
    return null;
  } catch {
    return null;
  }
}

function ProposalCard({ msg, onResolved }: { msg: ChatMessageView; onResolved: (id: string, status: string, summary?: string) => void }) {
  const [pending, startTransition] = useTransition();
  const payload = msg.proposalPayload ? JSON.parse(msg.proposalPayload) : {};

  function confirm() {
    startTransition(async () => {
      const res = await confirmProposal(msg.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(res.data.resultSummary);
      onResolved(msg.id, "CONFIRMED", res.data.resultSummary);
    });
  }
  function reject() {
    startTransition(async () => {
      const res = await rejectProposal(msg.id);
      if (!res.ok) { toast.error(res.error); return; }
      onResolved(msg.id, "REJECTED");
    });
  }

  const kindLabel = msg.proposalKind === "CREATE_ACTION" ? "Proposed Action" : msg.proposalKind === "CREATE_STAKEHOLDER" ? "Proposed Stakeholder" : "Proposed Question";
  const bodyText = msg.proposalKind === "CREATE_ACTION" ? payload.title : msg.proposalKind === "CREATE_STAKEHOLDER" ? payload.name : payload.questionText;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/[0.04] p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-primary">
        <Sparkles size={11} /> {kindLabel}
      </p>
      <p className="text-xs text-foreground">{bodyText}</p>
      {msg.proposalKind === "CREATE_STAKEHOLDER" && (payload.roleOnTracker || payload.ownsWhat) && (
        <p className="text-[10px] text-muted-foreground">
          {[payload.roleOnTracker, payload.ownsWhat].filter(Boolean).join(" · ")}
        </p>
      )}
      {msg.proposalStatus === "PENDING" ? (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={confirm} disabled={pending}><Check size={12} /> Confirm</Button>
          <Button size="sm" variant="outline" onClick={reject} disabled={pending}><Ban size={12} /> Reject</Button>
        </div>
      ) : (
        <span className={cn("w-fit rounded-full px-2 py-0.5 text-[9px] font-bold uppercase", msg.proposalStatus === "CONFIRMED" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
          {msg.proposalStatus}
        </span>
      )}
    </div>
  );
}

function MessageBubble({ msg, onResolved }: { msg: ChatMessageView; onResolved: (id: string, status: string, summary?: string) => void }) {
  if (msg.proposalKind) return <ProposalCard msg={msg} onResolved={onResolved} />;

  if (msg.role === "reasoning") return <ReasoningBubble content={msg.content ?? ""} />;

  if (msg.role === "tool") {
    // DB-loaded history (batch path) has no toolStatus at all — it's always
    // already resolved by the time it's fetched, so treat missing as "done".
    const status = (msg as LocalChatMessage).toolStatus ?? "done";
    if (status === "pending") {
      return (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Loader2 size={10} className="animate-spin" /> Fetching…
        </div>
      );
    }

    // Framework-skill results get the structured card; every other tool call
    // (search_trackers, get_tracker_details, non-framework apply_skill,
    // search_raw_events, get_raw_event) stays the generic, tool-name-free line.
    const parsed = parseFrameworkResult(msg.toolResult);
    if (parsed?.framework) return <FrameworkCard output={parsed.framework} skillApplied={parsed.skillApplied} />;
    if (parsed?.structuredOutputFailed && parsed.analysis) return <UnstructuredFrameworkCard analysis={parsed.analysis} skillApplied={parsed.skillApplied} />;

    return (
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Check size={10} /> Fetched
      </div>
    );
  }

  const isUser = msg.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[85%] rounded-xl px-3 py-2", isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
        {isUser ? <p className="text-xs leading-relaxed">{msg.content}</p> : <MarkdownBubble content={msg.content ?? ""} />}
      </div>
    </div>
  );
}

// toolStatus only ever exists client-side, mid-stream — DB rows (and
// eventToMessage's own "reasoning"/"proposal"/"final" cases) never set it,
// so MessageBubble treats "absent" as "already done".
type LocalChatMessage = ChatMessageView & { toolStatus?: "pending" | "done" };

// Turns a StreamEvent (lib/agent.ts) into the same shape the rest of the
// widget already renders (ChatMessageView), so MessageBubble doesn't need to
// know the difference between a streamed event and a DB row. tool_start/tool
// are handled directly in send() instead (they update one bubble in place
// rather than each appending a new one).
function eventToMessage(ev: StreamEvent): LocalChatMessage | null {
  switch (ev.type) {
    case "reasoning":
      return { id: ev.id, role: "reasoning", content: ev.content, toolName: null, toolResult: null, proposalKind: null, proposalPayload: null, proposalStatus: null, proposalTrackerId: null, createdAt: ev.createdAt };
    case "proposal":
      return { id: ev.id, role: "assistant", content: ev.content, toolName: null, toolResult: null, proposalKind: ev.proposalKind, proposalPayload: ev.proposalPayload, proposalStatus: ev.proposalStatus, proposalTrackerId: ev.proposalTrackerId, createdAt: ev.createdAt };
    case "final":
      return { id: ev.id, role: "assistant", content: ev.content, toolName: null, toolResult: null, proposalKind: null, proposalPayload: null, proposalStatus: null, proposalTrackerId: null, createdAt: ev.createdAt };
    default:
      return null;
  }
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !sessionId) {
      startTransition(async () => {
        const res = await getOrCreateActiveSession();
        if (!res.ok) { toast.error(res.error); return; }
        setSessionId(res.data.sessionId);
        setMessages(res.data.messages);
      });
    }
  }, [open, sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send() {
    if (!sessionId || !input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { id: `optimistic-${Date.now()}`, role: "user", content: text, toolName: null, toolResult: null, proposalKind: null, proposalPayload: null, proposalStatus: null, proposalTrackerId: null, createdAt: new Date().toISOString() }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Stream request failed." }));
        toast.error(err.error ?? "Stream request failed.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const ev = JSON.parse(line.slice(6)) as StreamEvent;
          if (ev.type === "error") { toast.error(ev.message); continue; }
          if (ev.type === "tool_start") {
            setMessages((prev) => [...prev, {
              id: ev.id, role: "tool", content: null, toolName: null, toolResult: null, proposalKind: null,
              proposalPayload: null, proposalStatus: null, proposalTrackerId: null,
              createdAt: new Date().toISOString(), toolStatus: "pending",
            }]);
            continue;
          }
          if (ev.type === "tool") {
            setMessages((prev) => prev.map((m) => (m.id === ev.id ? { ...m, toolStatus: "done", toolResult: ev.toolResult } : m)));
            continue;
          }
          const msg = eventToMessage(ev);
          if (msg) setMessages((prev) => [...prev, msg]);
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Stream connection failed.");
    } finally {
      setLoading(false);
    }
  }

  function newChat() {
    startTransition(async () => {
      const res = await startNewSession();
      if (!res.ok) { toast.error(res.error); return; }
      setSessionId(res.data.sessionId);
      setMessages([]);
    });
  }

  function onResolved(id: string, status: string, summary?: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, proposalStatus: status } : m)));
    if (summary) {
      setMessages((prev) => [...prev, { id: `system-${Date.now()}`, role: "assistant", content: summary, toolName: null, toolResult: null, proposalKind: null, proposalPayload: null, proposalStatus: null, proposalTrackerId: null, createdAt: new Date().toISOString() }]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
        style={{ background: "linear-gradient(135deg, oklch(0.46 0.19 258), oklch(0.30 0.18 268))" }}
        aria-label="Open GovEx assistant"
      >
        {open ? <X size={20} className="text-white" /> : <MessageCircle size={20} className="text-white" />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[520px] w-96 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3" style={{ background: "linear-gradient(90deg, oklch(0.46 0.19 258) 0%, oklch(0.30 0.18 268) 100%)" }}>
            <div>
              <p className="text-xs font-bold text-white">GovEx Assistant</p>
              <p className="text-[10px] text-white/60">Grounded in your tracker data</p>
            </div>
            <button type="button" onClick={newChat} className="flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white/20">
              <Plus size={11} /> New
            </button>
          </div>

          <div ref={scrollRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3">
            {messages.length === 0 && !pending && (
              <p className="mt-6 text-center text-[11px] text-muted-foreground">
                Ask about any tracker — status, risks, financials, SWOT, RAG rationale, or ask me to draft an action or question.
              </p>
            )}
            {messages.map((m) => <MessageBubble key={m.id} msg={m} onResolved={onResolved} />)}
            {loading && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Loader2 size={11} className="animate-spin" /> thinking…
              </div>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 border-t border-border p-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask GovEx…"
              disabled={loading}
              className="flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <Button size="sm" onClick={send} disabled={loading || !input.trim()}><Send size={13} /></Button>
          </div>
        </div>
      )}
    </>
  );
}
