import type { AdvisorStreamEvent } from "@/lib/advisor/service";
import { isAdvisorRateLimitError, streamAdvisorResponse } from "@/lib/advisor/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AdvisorStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        for await (const event of streamAdvisorResponse(body)) {
          // The client's Stop button aborts the fetch, which fires this signal.
          // Without checking it the generator ran to completion regardless: tokens
          // kept being billed for an answer nobody would see, and Langfuse recorded
          // it as delivered — quietly polluting the quality data we use to judge
          // prompt changes. Breaking here lets the generator's finally block run,
          // so the trace still flushes and is marked for what it was.
          if (request.signal.aborted) break;
          send(event);
        }
      } catch (error) {
        if (request.signal.aborted) {
          controller.close();
          return;
        }

        console.error("[advisor/respond] error:", error);
        send({
          type: "error",
          message: error instanceof Error ? error.message : "Unable to create advisor response.",
          isRateLimit: isAdvisorRateLimitError(error),
        });
      }

      controller.close();
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
