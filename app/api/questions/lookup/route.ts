import { NextResponse } from "next/server";
import { verifyIngestionToken } from "@/lib/ingestion";
import { prisma } from "@/lib/db";

// Used by the reply-capture Power Automate flow (a persistent "new message"
// trigger, never a "wait for response" action — see lib/outbound.ts notes).
// Given a stakeholder's email, returns their most recently ASKED (still
// unanswered) question so the flow can correlate a reply arriving at any
// point in the future — 15 minutes or 15 weeks later — back to the right
// question, with no timeout dependency on either side.
//
// GET /api/questions/lookup?stakeholderEmail=jane@indegene.com[&trackerId=...]
// Authorization: Bearer <ingestion API token>   (same keys as /api/ingest)
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing Authorization: Bearer <token> header." }, { status: 401 });
  }
  const resolved = await verifyIngestionToken(token);
  if (!resolved) {
    return NextResponse.json({ ok: false, error: "Invalid or revoked ingestion token." }, { status: 401 });
  }

  const url = new URL(req.url);
  const stakeholderEmail = url.searchParams.get("stakeholderEmail")?.trim().toLowerCase();
  const trackerId = url.searchParams.get("trackerId")?.trim() || undefined;
  if (!stakeholderEmail) {
    return NextResponse.json({ ok: false, error: "stakeholderEmail query param is required." }, { status: 400 });
  }

  // SQLite (unlike Postgres/Mongo) doesn't support Prisma's `mode: "insensitive"`
  // filter, so case-insensitive email matching is done in application code.
  const candidates = await prisma.openQuestion.findMany({
    where: {
      status: "ASKED",
      tracker: { orgId: resolved.orgId, ...(trackerId ? { id: trackerId } : {}) },
      stakeholder: { email: { not: null } },
    },
    orderBy: { askedAt: "desc" },
    include: { tracker: { select: { id: true, name: true } }, stakeholder: { select: { email: true } } },
  });
  const question = candidates.find((q) => q.stakeholder?.email?.toLowerCase() === stakeholderEmail);

  if (!question) {
    return NextResponse.json({ ok: true, found: false });
  }

  return NextResponse.json({
    ok: true,
    found: true,
    questionId: question.id,
    trackerId: question.tracker.id,
    trackerName: question.tracker.name,
    questionText: question.questionText,
    askedAt: question.askedAt,
  });
}
