import type { AdvisorStreamEvent } from "@/lib/advisor/service";
import { isAdvisorRateLimitError, streamAdvisorResponse } from "@/lib/advisor/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isInvitedEmail } from "@/lib/access";
import { getChatVisibility } from "@/lib/advisor/firm-visibility";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isInvitedEmail(user.email))) {
    return Response.json({ error: "Haven is invitation only." }, { status: 403 });
  }

  // A firm's client must be told their lawyer sees these chats before asking
  // (specs/advisor-chat-firm-visibility). Checked here, not only on screen.
  try {
    const visibility = await getChatVisibility(user.id);
    if (visibility.needsNotice) {
      return Response.json(
        {
          error: "needs_notice",
          firms: visibility.firms.map((f) => ({ firmId: f.firmId, firmName: f.firmName, acknowledgedAt: f.acknowledgedAt }))
        },
        { status: 409 }
      );
    }
  } catch (error) {
    console.error("[advisor/respond] could not check chat sharing:", error);
    return Response.json({ error: "Haven couldn't check who can see this chat. Try again in a moment." }, { status: 503 });
  }

  const body = await request.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let clientDisconnected = false;
      const send = (event: AdvisorStreamEvent) => {
        if (clientDisconnected) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          clientDisconnected = true;
        }
      };

      try {
        for await (const event of streamAdvisorResponse(body)) {
          // If the client navigates away or disconnects, mark clientDisconnected so
          // we stop trying to enqueue to a closed stream, but DO NOT break out of the
          // generator. Continuing to consume it lets persistExchange() and
          // rememberFactsFrom() run to completion, saving the answer to the database
          // in the background.
          if (!clientDisconnected && request.signal.aborted) {
            clientDisconnected = true;
          }
          send(event);
        }
      } catch (error) {
        if (clientDisconnected) {
          try {
            controller.close();
          } catch {}
          return;
        }

        console.error("[advisor/respond] error:", error);
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to create advisor response.",
          isRateLimit: isAdvisorRateLimitError(error),
        });
      }

      if (!clientDisconnected) {
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
