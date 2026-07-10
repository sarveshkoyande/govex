import type { FunctionDeclaration } from "@google/genai";
import { prisma } from "@/lib/db";
import { loadSkill } from "@/lib/skills";
import { generateText } from "@/lib/gemini";
import { SKILL_REGISTRY } from "@/lib/skillRegistry";

export interface ToolContext {
  orgId: string;
  sessionId: string;
}

// ===========================================================================
// Tool declarations — given to Gemini's function-calling API (lib/agent.ts).
// Read tools (search/get/apply_skill) execute for real and feed their result
// straight back to the model. Write tools (propose_*) NEVER mutate real data
// directly — they only create a PENDING proposal the user must confirm in
// the chat UI (see app/actions/chat.ts) before anything is actually created
// or sent. This is the human-confirmation boundary for the whole agent.
// ===========================================================================

// apply_skill's enum/description must include the org's CustomSkill names
// too (skills authored live via the Skills Library editor, lib/skillAuthoring.ts)
// — those don't exist at module-load time, so the declarations are built
// fresh per request instead of being a static array.
export async function getAgentToolDeclarations(orgId: string): Promise<FunctionDeclaration[]> {
  const customSkills = await prisma.customSkill.findMany({ where: { orgId }, select: { name: true, title: true, description: true } });
  const allSkillNames = [...SKILL_REGISTRY.map((s) => s.name), ...customSkills.map((s) => s.name)];
  const allSkillDescriptions = [
    ...SKILL_REGISTRY.map((s) => `${s.name} (${s.description})`),
    ...customSkills.map((s) => `${s.name} (${s.description})`),
  ].join(" | ");

  return [
    {
      name: "search_trackers",
      description: "Search the organization's trackers (themes) by name or domain substring. Call with an empty query to list all trackers.",
      parametersJsonSchema: {
        type: "object",
        properties: { query: { type: "string", description: "Substring to match against tracker name or domain name. Empty string lists everything." } },
        required: ["query"],
      },
    },
    {
      name: "get_tracker_details",
      description: "Fetch full structured context for one tracker: strategy goals, OKRs, financials, risks, stakeholders, micro-battles/tactics/insights, open questions, decisions. Use this before answering any question about a specific tracker.",
      parametersJsonSchema: {
        type: "object",
        properties: { trackerId: { type: "string" } },
        required: ["trackerId"],
      },
    },
    {
      name: "apply_skill",
      description: `Apply one named analytical skill to a tracker to answer a specific focus question, grounded in that tracker's real data. Available skills: ${allSkillDescriptions}`,
      parametersJsonSchema: {
        type: "object",
        properties: {
          skillName: { type: "string", enum: allSkillNames },
          trackerId: { type: "string" },
          focus: { type: "string", description: "The specific question or angle to apply the skill to, e.g. 'is this tracker's cost synergy on track?'" },
        },
        required: ["skillName", "trackerId", "focus"],
      },
    },
    {
      name: "search_raw_events",
    description:
      "List this tracker's raw ingested events (emails, meeting notes, stakeholder replies) as a lightweight manifest — id, subject, source, date, and a proportional summary, NOT full text. These are stakeholder contributions yet to be reviewed and approved — use this when the approved tracker data (get_tracker_details) doesn't fully answer the question, to judge for yourself whether any raw contribution is relevant. Judge relevance from the summaries; do not assume a fixed number are relevant.",
    parametersJsonSchema: {
      type: "object",
      properties: { trackerId: { type: "string" } },
      required: ["trackerId"],
    },
  },
  {
    name: "get_raw_event",
    description: "Fetch the full text of one raw ingestion event by id (from search_raw_events) once you've judged it's actually relevant.",
    parametersJsonSchema: {
      type: "object",
      properties: { eventId: { type: "string" } },
      required: ["eventId"],
    },
  },
  {
    name: "propose_create_action",
    description: "Propose creating a new next-action item on a tracker. This does NOT create it yet — it stages a proposal the user must explicitly confirm in the chat UI.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        trackerId: { type: "string" },
        title: { type: "string" },
        owner: { type: "string" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        dueDate: { type: "string", description: "Free text, e.g. 'Oct 10' or 'Ongoing'." },
      },
      required: ["trackerId", "title"],
    },
  },
  {
    name: "propose_draft_question",
    description: "Propose drafting (and, once confirmed, sending) a stakeholder question on a tracker. This does NOT send anything yet — it stages a proposal the user must explicitly confirm in the chat UI.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        trackerId: { type: "string" },
        questionText: { type: "string" },
        stakeholderId: { type: "string", description: "Optional — omit to fall back to the tracker's primary stakeholder." },
      },
      required: ["trackerId", "questionText"],
    },
  },
  ];
}

async function searchTrackers(ctx: ToolContext, args: { query?: string }) {
  const query = (args.query ?? "").trim();
  const trackers = await prisma.tracker.findMany({
    where: {
      orgId: ctx.orgId,
      ...(query
        ? { OR: [{ name: { contains: query } }, { domain: { name: { contains: query } } }] }
        : {}),
    },
    select: { id: true, name: true, signalStatus: true, ragStatus: true, domain: { select: { name: true } } },
    take: 25,
  });
  return { trackers: trackers.map((t) => ({ id: t.id, name: t.name, domain: t.domain.name, signalStatus: t.signalStatus, ragStatus: t.ragStatus })) };
}

async function getTrackerDetails(ctx: ToolContext, args: { trackerId: string }) {
  const tracker = await prisma.tracker.findFirst({
    where: { id: args.trackerId, orgId: ctx.orgId },
    include: {
      domain: { select: { name: true } },
      strategyGoals: { orderBy: { order: "asc" } },
      okrs: { orderBy: { order: "asc" } },
      strategyInsights: { orderBy: { order: "asc" } },
      stakeholders: true,
      financialMetrics: true,
      risks: true,
      decisionLog: { orderBy: { createdAt: "desc" }, take: 10 },
      microBattles: { include: { executionTactics: { include: { insights: true } } } },
    },
  });
  if (!tracker) return { error: "Tracker not found in this organization." };

  const openQuestions = await prisma.openQuestion.findMany({
    where: { trackerId: tracker.id, status: { in: ["ASKED", "ANSWERED"] } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { questionText: true, status: true, answerVerdict: true, targetSummary: true },
  });

  return {
    id: tracker.id,
    name: tracker.name,
    domain: tracker.domain.name,
    description: tracker.description,
    signalStatus: tracker.signalStatus,
    ragStatus: tracker.ragStatus,
    ownerName: tracker.ownerName,
    targetPeriod: tracker.targetPeriod,
    budget: tracker.budget,
    spend: tracker.spend,
    forecast: tracker.forecast,
    strategyGoals: tracker.strategyGoals.map((g) => g.text),
    okrs: tracker.okrs.map((o) => ({ title: o.title, metrics: o.metrics })),
    strategyInsights: tracker.strategyInsights.map((s) => ({ title: s.title, description: s.description, signal: undefined })),
    stakeholders: tracker.stakeholders.map((s) => ({ id: s.id, name: s.name, ownsWhat: s.ownsWhat, isPrimary: s.isPrimary })),
    financialMetrics: tracker.financialMetrics.map((f) => ({ label: f.label, period: f.period, planned: f.planned, actual: f.actual, forecast: f.forecast })),
    risks: tracker.risks.map((r) => ({ title: r.title, severity: r.severity, status: r.status, mitigation: r.mitigation })),
    decisionLog: tracker.decisionLog.map((d) => ({ decision: d.decision, rationale: d.rationale })),
    microBattles: tracker.microBattles.map((mb) => ({
      name: mb.name,
      ragStatus: mb.ragStatus,
      tactics: mb.executionTactics.map((t) => ({
        name: t.name,
        expectedOutcome: t.expectedOutcome,
        insights: t.insights.map((i) => ({ kind: i.kind, signal: i.signal, text: i.text })),
      })),
    })),
    openQuestions: openQuestions.map((q) => ({ text: q.targetSummary, status: q.status, verdict: q.answerVerdict })),
  };
}

async function applySkillTool(args: { skillName: string; trackerId: string; focus: string }, ctx: ToolContext) {
  const builtIn = SKILL_REGISTRY.find((s) => s.name === args.skillName);
  let skillText: string;
  let skillTitle: string;

  if (builtIn) {
    skillText = loadSkill(builtIn.name);
    skillTitle = builtIn.title;
  } else {
    // Not a built-in — check org-authored skills (lib/skillAuthoring.ts).
    const custom = await prisma.customSkill.findFirst({ where: { orgId: ctx.orgId, name: args.skillName } });
    if (!custom) return { error: `Unknown skill "${args.skillName}".` };
    skillText = custom.content;
    skillTitle = custom.title;
  }

  const details = await getTrackerDetails(ctx, { trackerId: args.trackerId });
  if ("error" in details) return details;

  const prompt = `You are applying exactly one analytical skill to answer a focused question about one tracker. Use ONLY the supplied data — never invent facts. Return a concise, well-grounded plain-text analysis (not JSON), citing specific figures/names from the data.

${skillText}

## Tracker data
${JSON.stringify(details, null, 2)}

## Focus question
${args.focus}`;

  try {
    const text = await generateText(prompt);
    return { analysis: text, skillApplied: skillTitle };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Skill application failed." };
  }
}

async function searchRawEvents(ctx: ToolContext, args: { trackerId: string }) {
  const tracker = await prisma.tracker.findFirst({ where: { id: args.trackerId, orgId: ctx.orgId }, select: { id: true } });
  if (!tracker) return { error: "Tracker not found in this organization." };

  const events = await prisma.rawIngestionEvent.findMany({
    where: { trackerId: tracker.id },
    orderBy: { occurredAt: "desc" },
    take: 50,
    select: { id: true, subject: true, source: true, occurredAt: true, status: true, summary: true, rawText: true },
  });

  return {
    note: "These are stakeholder contributions yet to be reviewed — judge relevance from the summary, then call get_raw_event for the full text of anything relevant.",
    events: events.map((e) => ({
      id: e.id,
      subject: e.subject,
      source: e.source,
      occurredAt: e.occurredAt,
      reviewed: e.status === "REVIEWED",
      // Falls back to a plain truncation only for the rare event whose
      // background summary (lib/ingestionSummary.ts) hasn't finished yet.
      summary: e.summary ?? `${e.rawText.slice(0, 200)}${e.rawText.length > 200 ? "…" : ""}`,
    })),
  };
}

async function getRawEvent(ctx: ToolContext, args: { eventId: string }) {
  const event = await prisma.rawIngestionEvent.findFirst({
    where: { id: args.eventId, tracker: { orgId: ctx.orgId } },
  });
  if (!event) return { error: "Event not found in this organization." };
  return {
    id: event.id,
    subject: event.subject,
    source: event.source,
    occurredAt: event.occurredAt,
    reviewed: event.status === "REVIEWED",
    contributedBy: event.fromAddress,
    participants: event.participants,
    rawText: event.rawText,
  };
}

async function proposeCreateAction(
  ctx: ToolContext,
  args: { trackerId: string; title: string; owner?: string; priority?: string; dueDate?: string },
) {
  const tracker = await prisma.tracker.findFirst({ where: { id: args.trackerId, orgId: ctx.orgId }, select: { id: true, name: true } });
  if (!tracker) return { error: "Tracker not found in this organization." };

  const message = await prisma.chatMessage.create({
    data: {
      sessionId: ctx.sessionId,
      role: "assistant",
      content: `Proposed action for **${tracker.name}**: "${args.title}"`,
      proposalKind: "CREATE_ACTION",
      proposalStatus: "PENDING",
      proposalTrackerId: tracker.id,
      proposalPayload: JSON.stringify({
        title: args.title,
        owner: args.owner ?? "",
        priority: args.priority ?? "medium",
        dueDate: args.dueDate ?? "",
      }),
    },
  });

  return { proposalId: message.id, status: "pending_confirmation", note: "Staged, not created yet. Tell the user to confirm or reject it in the chat." };
}

async function proposeDraftQuestion(ctx: ToolContext, args: { trackerId: string; questionText: string; stakeholderId?: string }) {
  const tracker = await prisma.tracker.findFirst({ where: { id: args.trackerId, orgId: ctx.orgId }, select: { id: true, name: true } });
  if (!tracker) return { error: "Tracker not found in this organization." };

  if (args.stakeholderId) {
    const stakeholder = await prisma.stakeholder.findFirst({ where: { id: args.stakeholderId, trackerId: tracker.id } });
    if (!stakeholder) return { error: "That stakeholder doesn't belong to this tracker." };
  }

  const message = await prisma.chatMessage.create({
    data: {
      sessionId: ctx.sessionId,
      role: "assistant",
      content: `Proposed question for **${tracker.name}**: "${args.questionText}"`,
      proposalKind: "DRAFT_QUESTION",
      proposalStatus: "PENDING",
      proposalTrackerId: tracker.id,
      proposalPayload: JSON.stringify({ questionText: args.questionText, stakeholderId: args.stakeholderId ?? null }),
    },
  });

  return { proposalId: message.id, status: "pending_confirmation", note: "Staged, not sent yet. Tell the user to confirm or reject it in the chat." };
}

export async function executeAgentTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    case "search_trackers":
      return searchTrackers(ctx, args as { query?: string });
    case "get_tracker_details":
      return getTrackerDetails(ctx, args as { trackerId: string });
    case "apply_skill":
      return applySkillTool(args as { skillName: string; trackerId: string; focus: string }, ctx);
    case "search_raw_events":
      return searchRawEvents(ctx, args as { trackerId: string });
    case "get_raw_event":
      return getRawEvent(ctx, args as { eventId: string });
    case "propose_create_action":
      return proposeCreateAction(ctx, args as { trackerId: string; title: string; owner?: string; priority?: string; dueDate?: string });
    case "propose_draft_question":
      return proposeDraftQuestion(ctx, args as { trackerId: string; questionText: string; stakeholderId?: string });
    default:
      return { error: `Unknown tool "${name}".` };
  }
}
