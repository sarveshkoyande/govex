import { NextResponse } from "next/server";
import { verifyIngestionToken } from "@/lib/ingestion";
import { prisma } from "@/lib/db";

// Step 1 of the two-call drive sync — the Power Automate flow lists every
// file in a tracker's folder (metadata only: id/name, no content) and POSTs
// that list here. GovEx does the actual "have we already ingested this file"
// check against DriveSyncedFile (a per-file ledger) and returns only the
// ones it's never seen before. Existence-only — files in this folder are
// static once placed, never edited in place, so there's no "changed since"
// case to detect, just "new" vs. "already synced." Keeps the comparison in
// testable code instead of Power Automate's Condition UI.
//
// POST /api/drive-sync/compare
// Authorization: Bearer <ingestion API token>   (same keys as /api/ingest)
// body: { trackerId: string, files: [{ id: string, name: string }] }
// response: { ok: true, needed: [{ id: string, name: string }] }
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

  const { trackerId, files } = (body ?? {}) as { trackerId?: unknown; files?: unknown };
  if (typeof trackerId !== "string" || !trackerId) {
    return NextResponse.json({ ok: false, error: "trackerId is required." }, { status: 400 });
  }
  if (!Array.isArray(files)) {
    return NextResponse.json({ ok: false, error: "files must be an array." }, { status: 400 });
  }

  const tracker = await prisma.tracker.findFirst({ where: { id: trackerId, orgId: resolved.orgId } });
  if (!tracker) {
    return NextResponse.json({ ok: false, error: "Tracker not found in this organization." }, { status: 404 });
  }

  const candidates = files.filter(
    (f): f is { id: string; name: string } => !!f && typeof f === "object" && typeof (f as { id?: unknown }).id === "string",
  );
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, needed: [] });
  }

  const existing = await prisma.driveSyncedFile.findMany({
    where: { trackerId, driveFileId: { in: candidates.map((c) => c.id) } },
    select: { driveFileId: true },
  });
  const alreadySynced = new Set(existing.map((e) => e.driveFileId));

  const needed = candidates.filter((c) => !alreadySynced.has(c.id));

  return NextResponse.json({ ok: true, needed: needed.map((n) => ({ id: n.id, name: n.name })) });
}
