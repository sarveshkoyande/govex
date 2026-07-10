import { NextResponse } from "next/server";

// Dev-only echo endpoint. Point the Outbound Webhook config at this URL to
// prove the outbound HTTP contract (headers, payload shape) works end-to-end
// before you have a real Power Automate flow to receive it. Not meant for
// production use — it does nothing but log and echo back what it received.
export async function POST(req: Request) {
  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    // ignore — echo whatever we got
  }
  console.log("[dev/echo] received:", JSON.stringify(body));
  return NextResponse.json({ ok: true, received: body });
}
