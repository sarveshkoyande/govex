import { NextResponse } from "next/server";

// Dev-only echo endpoint. Point the Outbound Webhook config (or any Power
// Automate HTTP action) at this URL to prove the outbound HTTP contract
// (headers, payload shape) works end-to-end before you have a real receiving
// flow — or, since Power Automate masks the Authorization value in its own
// run history ("*sanitized*"), to actually see what it sent when a real
// endpoint is rejecting it with "invalid token". Not meant for production
// use — it does nothing but log and echo back what it received.
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // ignore — echo whatever we got
  }
  console.log("[dev/echo] received:", JSON.stringify({ authHeader, body }));
  return NextResponse.json({
    ok: true,
    authHeaderReceived: authHeader,
    authHeaderLength: authHeader?.length ?? 0,
    received: body,
  });
}
