import { NextResponse } from "next/server";
import { verifyIngestionToken, ingestEvent } from "@/lib/ingestion";

// Stage 1 ingestion webhook. Point a Power Automate flow (or the in-app test
// injector) here with:
//   Authorization: Bearer <org ingestion token>
//   Content-Type: application/json
//   body: { trackerId, source, sourceSystem, subject?, fromAddress?,
//            participants?, occurredAt?, rawText, rawPayload? }
// This is a machine-to-machine endpoint — it authenticates via the bearer
// token (see IngestionApiKey), not the browser session cookie.
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

  const result = await ingestEvent(resolved.orgId, resolved.keyId, "webhook", body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }
  return NextResponse.json({ ok: true, eventId: result.eventId }, { status: 201 });
}
