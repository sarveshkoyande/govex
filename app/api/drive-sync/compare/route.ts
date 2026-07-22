import { NextResponse } from "next/server";
import { verifyIngestionToken } from "@/lib/ingestion";
import { prisma } from "@/lib/db";

// Step 1 of the two-call drive sync — the Power Automate flow lists every
// file in a tracker's folder (metadata only, id/name/modified time, no
// content) and POSTs that list here. GovEx does the actual "is this new or
// changed" comparison against DriveSyncedFile (per-file ledger, not one
// blunt tracker-level timestamp) and returns only the subset the flow
// actually needs to fetch content for and POST to /api/ingest. Keeps the
// comparison logic in code, testable, instead of Power Automate's Condition
// UI trying to replicate it per file.
//
// POST /api/drive-sync/compare
// Authorization: Bearer <ingestion API token>   (same keys as /api/ingest)
// body: { trackerId: string, files: [{ id: string, name: string, modifiedAt: string }] }
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

  const candidates = files
    .filter((f): f is { id: string; name: string; modifiedAt: string } =>
      !!f && typeof f === "object" && typeof (f as { id?: unknown }).id === "string" && typeof (f as { modifiedAt?: unknown }).modifiedAt === "string",
    );

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, needed: [] });
  }

  const existing = await prisma.driveSyncedFile.findMany({
    where: { trackerId, driveFileId: { in: candidates.map((c) => c.id) } },
    select: { driveFileId: true, driveModifiedAt: true },
  });
  const existingByFileId = new Map(existing.map((e) => [e.driveFileId, e.driveModifiedAt]));

  // Needed = never synced before, OR the file's own modified time has moved
  // on since the version we last ingested (a real edit, not just a re-list).
  const needed = candidates.filter((c) => {
    const lastSynced = existingByFileId.get(c.id);
    if (!lastSynced) return true;
    return new Date(c.modifiedAt).getTime() > lastSynced.getTime();
  });

  return NextResponse.json({ ok: true, needed: needed.map((n) => ({ id: n.id, name: n.name })) });
}
