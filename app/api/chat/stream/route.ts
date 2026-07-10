import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { streamAgentTurn } from "@/lib/agent";

// Browser-facing streaming counterpart of app/actions/chat.ts's
// sendChatMessage — session-cookie auth (not a bearer token), so this is
// NOT in middleware.ts's public-route list; it goes through the normal
// logged-in-user gate like any other app page/action.
//
// POST /api/chat/stream
// body: { sessionId: string, message: string }
// Response: text/event-stream — one `data: <JSON StreamEvent>\n\n` line per
// orchestration step (reasoning, tool call, proposal, final answer), so the
// chat widget can render each step the instant it's ready instead of
// waiting for the whole multi-round agent turn to finish.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be valid JSON." }, { status: 400 });
  }
  const { sessionId, message } = (body ?? {}) as { sessionId?: unknown; message?: unknown };
  if (typeof sessionId !== "string" || !sessionId) {
    return NextResponse.json({ ok: false, error: "sessionId is required." }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ ok: false, error: "message is required." }, { status: 400 });
  }

  const session = await prisma.chatSession.findFirst({ where: { id: sessionId, orgId: user.orgId, userId: user.id } });
  if (!session) return NextResponse.json({ ok: false, error: "Chat session not found." }, { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }
      try {
        for await (const event of streamAgentTurn(sessionId, user.orgId, message.trim())) {
          send(event);
        }
        // Auto-title from the first user message, same as the batch path.
        if (session.title === "New chat") {
          await prisma.chatSession.update({ where: { id: sessionId }, data: { title: message.trim().slice(0, 60) } });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Agent turn failed.";
        await prisma.chatMessage.create({ data: { sessionId, role: "assistant", content: `Sorry — something went wrong: ${errMsg}` } });
        send({ type: "error", message: errMsg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
