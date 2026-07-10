import { NextResponse } from "next/server";
import { verifyIngestionToken, ingestEvent } from "@/lib/ingestion";
import { prisma } from "@/lib/db";

// Receiver for the "Post adaptive card and wait for a response" Power
// Automate flow. That flow already IS the correlation mechanism (it's a
// single run per question, blocked on that one card), so all it needs to
// hand back is { ticketId, answerText } — ticketId is the OpenQuestion.id
// that was sent out in sendQuestion's payload as `ticketId`. This route
// looks up the question's tracker itself so the flow never has to carry
// trackerId around.
//
// POST /api/questions/answer
// Authorization: Bearer <ingestion API token>   (same keys as /api/ingest)
// body: { ticketId: string, answerText: string }
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing Authorization: Bearer <token> header." }, { status: 401 });
  }
  const resolved = await verifyIngestionToken(token);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "Invalid or revoked ingestion token." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be valid JSON." }, { status: 400 });
  }

  const { ticketId, answerText } = (body ?? {}) as { ticketId?: unknown; answerText?: unknown };
  if (typeof ticketId !== "string" || !ticketId) {
    return NextResponse.json({ ok: false, error: "ticketId is required." }, { status: 400 });
  }
  if (typeof answerText !== "string" || !answerText.trim()) {
    return NextResponse.json({ ok: false, error: "answerText is required." }, { status: 400 });
  }

  const question = await prisma.openQuestion.findFirst({
    where: { id: ticketId, tracker: { orgId: resolved.orgId } },
    include: { stakeholder: { select: { email: true, name: true } } },
  });
  if (!question) {
    return NextResponse.json({ ok: false, error: "No question found for this ticketId in this organization." }, { status: 404 });
  }

  const result = await ingestEvent(resolved.orgId, resolved.keyId, "webhook", {
    trackerId: question.trackerId,
    source: "TEAMS",
    sourceSystem: "teams-adaptive-card",
    rawText: answerText,
    answersQuestionId: ticketId,
    // The reply is reasonably attributed to whoever the question was asked
    // of — this is what makes get_raw_event's contributedBy field non-null
    // for Teams-sourced replies, so the chat agent can cite who answered.
    fromAddress: question.stakeholder?.email || undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true, eventId: result.eventId }, { status: 201 });
}
