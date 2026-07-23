import { createPartFromFunctionResponse } from "@google/genai";
import { getGeminiClient, GEMINI_MODEL_NAME } from "@/lib/gemini";
import { getAgentToolDeclarations, executeAgentTool } from "@/lib/agentTools";
import { prisma } from "@/lib/db";

const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT = `You are the GovEx assistant — a goal-oriented orchestrator over the GovEx tracker database, not a single-prompt chatbot. You have tools to search trackers, fetch a tracker's full context, and apply named analytical skills (business frameworks, financial analysis) to answer grounded questions. Use them; never answer from assumption when a tool can ground the answer in real data.

Rules:
- Before every tool call, first output one short plain-language sentence stating which tool/skill you are about to call and why — e.g. "Fetching the tracker's full record to ground this in real figures." or "Applying financial-variance-analysis to quantify the plan/actual gap before assessing margin health." Then call the tool. Never call a tool silently.
- If a request is ambiguous (which tracker? which risk? what time period?), ask a clarifying question instead of guessing — end your turn with the question rather than calling a tool with a guessed argument.
- Always call get_tracker_details before answering anything specific about a tracker you haven't already fetched this conversation.
- Use apply_skill when the user's ask matches a specific analytical lens (SWOT, OKR alignment, RAG scoring, financial variance, margin/synergy) rather than trying to reason about it yourself inline — the skill's grounded output is more reliable than freeform reasoning.
- Skills can and should be chained: after reading one skill's output, decide whether a second skill would sharpen the answer (e.g. financial-variance-analysis flags a margin gap → follow with margin-and-synergy-analysis; a SWOT surfaces a misaligned initiative → follow with okr-alignment-assessment). State that follow-on decision as its own one-sentence narration before calling the next skill, exactly like the first. Only stop chaining once you have what's needed to answer — don't call skills that don't add anything.
- To create an action item, draft a stakeholder question, or add a stakeholder, ALWAYS use propose_create_action / propose_draft_question / propose_create_stakeholder — these only stage a proposal, they never execute directly. After calling one, tell the user what you've staged and that it's awaiting their confirmation in the chat UI. Never claim something was created or sent — only that it's proposed.
- When a question is specifically about stakeholders on a tracker, or you're generally reviewing a tracker's people, call list_unresolved_entities to check for names that keep coming up in ingested text but aren't tracked yet. Only call propose_create_stakeholder for ones that are clearly relevant to what's being discussed — do not reflexively propose every candidate it returns just because the list is non-empty.
- Whenever asked how one tracker relates to another, whether two engagements share anything in common, or for any cross-theme/cross-tracker comparison, call get_tracker_connections BEFORE reasoning about it yourself — it returns the actual Gemini-judged thematic connections and named mentions already computed for that tracker. Cite its reasoning specifically; never guess at a cross-theme connection from your own inference when this tool exists to ground it.
- Ground every claim in specific data returned by your tools (numbers, names, dates). Say so explicitly if the data needed to answer isn't available rather than filling the gap with a plausible-sounding guess.
- HARD RULE: you may NEVER end a turn telling the user something is "not available," "not yet reported," "not recorded," or similarly missing UNTIL you have called search_raw_events for that tracker first. The approved tracker data being silent on something is not evidence it's unknown — it's the exact trigger to check search_raw_events, because a stakeholder may have already answered it in a contribution that hasn't been synthesized into the structured data yet. Treat "the approved data doesn't say" and "the answer doesn't exist" as two completely different things — only the tools can tell you which one is true.
- When you do call search_raw_events, judge relevance from the summaries yourself (there's no fixed number to check — read them like you'd read a list of email subject lines), then call get_raw_event for the full text of anything that looks relevant.
- Never call anything from search_raw_events/get_raw_event "unreviewed" or "from an unreviewed source" — call it a "stakeholder contribution — yet to be reviewed." This is a wording rule, not optional phrasing.
- When you cite a raw stakeholder contribution (get_raw_event), also state who contributed it if contributedBy is present. Cross-reference that email against the tracker's stakeholder list from get_tracker_details (fetch it first if you haven't already) — if it matches a named stakeholder, cite their name and role, e.g. "a stakeholder contribution from Priya Shah (Delivery Lead), yet to be reviewed," not just the raw email. Only fall back to the bare email if no stakeholder record matches it.
- If the same fact appears in both the approved tracker data and a raw stakeholder contribution, state it once, citing the approved data — do not repeat it a second time as if it were new information from the raw contribution.
- Keep the final answer concise and direct — this is an executive tool, not a conversation for its own sake. The per-step narrations stay short (one sentence); save the substance for the tool output and the final answer.`;

export interface AgentTurnResult {
  reply: string;
  pendingProposalIds: string[];
}

// Event-per-step shape for the streaming path (app/api/chat/stream). Each
// event carries the already-persisted ChatMessage's id/createdAt so the
// client can render it directly without a follow-up fetch. Coarser than
// true token-by-token streaming (we stream at "one step finished" grain, not
// per-token) — that's a deliberate simplification: it already turns the
// "everything at once" batch response into a live, incremental one, without
// the added complexity of buffering partial Gemini text deltas mid-sentence.
export type StreamEvent =
  | { type: "reasoning"; id: string; content: string; createdAt: string }
  | { type: "tool_start"; id: string }
  | { type: "tool"; id: string; toolName: string; createdAt: string; toolResult: string }
  | { type: "proposal"; id: string; content: string; proposalKind: string; proposalPayload: string; proposalStatus: string; proposalTrackerId: string; createdAt: string }
  | { type: "final"; id: string; content: string; createdAt: string; pendingProposalIds: string[] }
  | { type: "error"; message: string };

export async function runAgentTurn(sessionId: string, orgId: string, userMessage: string): Promise<AgentTurnResult> {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error(`ChatSession ${sessionId} not found`);
  if (session.orgId !== orgId) throw new Error("Session does not belong to this organization.");

  let history: unknown[] = [];
  try {
    history = JSON.parse(session.historyJson || "[]");
  } catch {
    history = [];
  }

  const ai = getGeminiClient();
  const toolDeclarations = await getAgentToolDeclarations(orgId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chat = ai.chats.create({
    model: GEMINI_MODEL_NAME,
    history: history as any,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: toolDeclarations }],
      automaticFunctionCalling: { disable: true },
      temperature: 0.3,
    },
  });

  await prisma.chatMessage.create({ data: { sessionId, role: "user", content: userMessage } });

  // Per the system prompt, the model is required to narrate a one-sentence
  // decision ("calling apply_skill(X) because...") in its text output
  // immediately before each tool call, in the same response turn as the
  // function call itself. That narration is what response.text holds
  // whenever functionCalls are also present — persist it as its own message
  // so the transcript reads as an explicit orchestration trace (decide ->
  // call -> result -> decide next), not a raw internal-thought dump.
  async function recordStepNarration(res: Awaited<ReturnType<typeof chat.sendMessage>>) {
    const narration = res.text?.trim();
    if (narration && res.functionCalls && res.functionCalls.length > 0) {
      await prisma.chatMessage.create({ data: { sessionId, role: "reasoning", content: narration } });
    }
  }

  let response = await chat.sendMessage({ message: userMessage });
  await recordStepNarration(response);
  let rounds = 0;
  const pendingProposalIds: string[] = [];

  while (response.functionCalls && response.functionCalls.length > 0 && rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    const responseParts = [];

    for (const call of response.functionCalls) {
      const name = call.name ?? "unknown_tool";
      const args = (call.args ?? {}) as Record<string, unknown>;
      const callId = call.id ?? `${name}-${rounds}`;

      let result: unknown;
      try {
        result = await executeAgentTool(name, args, { orgId, sessionId });
      } catch (err) {
        result = { error: err instanceof Error ? err.message : "Tool execution failed." };
      }

      await prisma.chatMessage.create({
        data: { sessionId, role: "tool", toolName: name, toolArgs: JSON.stringify(args), toolResult: JSON.stringify(result) },
      });

      if (result && typeof result === "object" && "proposalId" in result) {
        pendingProposalIds.push(String((result as { proposalId: unknown }).proposalId));
      }

      responseParts.push(createPartFromFunctionResponse(callId, name, result as Record<string, unknown>));
    }

    response = await chat.sendMessage({ message: responseParts });
    await recordStepNarration(response);
  }

  const finalText = response.text ?? "(No response — the agent may have hit its tool-call limit for this turn.)";
  await prisma.chatMessage.create({ data: { sessionId, role: "assistant", content: finalText } });

  const newHistory = chat.getHistory();
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { historyJson: JSON.stringify(newHistory), updatedAt: new Date() },
  });

  return { reply: finalText, pendingProposalIds };
}

// Streaming counterpart of runAgentTurn, for app/api/chat/stream. Same
// orchestration logic — same system prompt, same tool loop, same DB writes —
// just yields a StreamEvent the instant each step is persisted instead of
// silently accumulating everything and returning once at the end.
export async function* streamAgentTurn(sessionId: string, orgId: string, userMessage: string): AsyncGenerator<StreamEvent> {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error(`ChatSession ${sessionId} not found`);
  if (session.orgId !== orgId) throw new Error("Session does not belong to this organization.");

  let history: unknown[] = [];
  try {
    history = JSON.parse(session.historyJson || "[]");
  } catch {
    history = [];
  }

  const ai = getGeminiClient();
  const toolDeclarations = await getAgentToolDeclarations(orgId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chat = ai.chats.create({
    model: GEMINI_MODEL_NAME,
    history: history as any,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: toolDeclarations }],
      automaticFunctionCalling: { disable: true },
      temperature: 0.3,
    },
  });

  await prisma.chatMessage.create({ data: { sessionId, role: "user", content: userMessage } });

  async function* recordStepNarration(res: Awaited<ReturnType<typeof chat.sendMessage>>): AsyncGenerator<StreamEvent> {
    const narration = res.text?.trim();
    if (narration && res.functionCalls && res.functionCalls.length > 0) {
      const m = await prisma.chatMessage.create({ data: { sessionId, role: "reasoning", content: narration } });
      yield { type: "reasoning", id: m.id, content: narration, createdAt: m.createdAt.toISOString() };
    }
  }

  let response = await chat.sendMessage({ message: userMessage });
  yield* recordStepNarration(response);
  let rounds = 0;
  const pendingProposalIds: string[] = [];

  while (response.functionCalls && response.functionCalls.length > 0 && rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    const responseParts = [];

    for (const call of response.functionCalls) {
      const name = call.name ?? "unknown_tool";
      const args = (call.args ?? {}) as Record<string, unknown>;
      const callId = call.id ?? `${name}-${rounds}`;

      // Client only shows a generic "Fetching…" -> "Fetched" transition, never
      // the tool name — this id just correlates the pending bubble to its
      // resolution, no user-facing meaning.
      const stepId = `step-${sessionId}-${rounds}-${callId}`;
      yield { type: "tool_start", id: stepId };

      let result: unknown;
      try {
        result = await executeAgentTool(name, args, { orgId, sessionId });
      } catch (err) {
        result = { error: err instanceof Error ? err.message : "Tool execution failed." };
      }

      const toolMsg = await prisma.chatMessage.create({
        data: { sessionId, role: "tool", toolName: name, toolArgs: JSON.stringify(args), toolResult: JSON.stringify(result) },
      });
      yield { type: "tool", id: stepId, toolName: name, createdAt: toolMsg.createdAt.toISOString(), toolResult: JSON.stringify(result) };

      if (result && typeof result === "object" && "proposalId" in result) {
        const proposalId = String((result as { proposalId: unknown }).proposalId);
        pendingProposalIds.push(proposalId);
        // propose_create_action / propose_draft_question already created this
        // message row themselves (see lib/agentTools.ts) — fetch and stream
        // it now so the ProposalCard renders live instead of waiting for the
        // final batch.
        const proposalMsg = await prisma.chatMessage.findUnique({ where: { id: proposalId } });
        if (proposalMsg?.proposalKind) {
          yield {
            type: "proposal",
            id: proposalMsg.id,
            content: proposalMsg.content ?? "",
            proposalKind: proposalMsg.proposalKind,
            proposalPayload: proposalMsg.proposalPayload ?? "{}",
            proposalStatus: proposalMsg.proposalStatus ?? "PENDING",
            proposalTrackerId: proposalMsg.proposalTrackerId ?? "",
            createdAt: proposalMsg.createdAt.toISOString(),
          };
        }
      }

      responseParts.push(createPartFromFunctionResponse(callId, name, result as Record<string, unknown>));
    }

    response = await chat.sendMessage({ message: responseParts });
    yield* recordStepNarration(response);
  }

  const finalText = response.text ?? "(No response — the agent may have hit its tool-call limit for this turn.)";
  const finalMsg = await prisma.chatMessage.create({ data: { sessionId, role: "assistant", content: finalText } });
  yield { type: "final", id: finalMsg.id, content: finalText, createdAt: finalMsg.createdAt.toISOString(), pendingProposalIds };

  const newHistory = chat.getHistory();
  await prisma.chatSession.update({
    where: { id: sessionId },
    data: { historyJson: JSON.stringify(newHistory), updatedAt: new Date() },
  });
}
