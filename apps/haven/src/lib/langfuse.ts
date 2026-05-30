/**
 * Langfuse LLM observability client.
 *
 * IMPORTANT — serverless flush:
 * Vercel freezes the function immediately after the response is sent.
 * Langfuse's background flush interval never fires in this environment.
 * Always call `await flushLangfuse()` before returning from a route handler
 * or server action that makes AI calls.
 */
import { Langfuse } from "langfuse";

import { env } from "@/lib/env";

let _client: Langfuse | null = null;
let _attempted = false;

export function getLangfuseClient(): Langfuse | null {
  if (_attempted) return _client;
  _attempted = true;

  if (!env.LANGFUSE_SECRET_KEY || !env.LANGFUSE_PUBLIC_KEY) {
    return null;
  }

  try {
    _client = new Langfuse({
      secretKey: env.LANGFUSE_SECRET_KEY,
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      baseUrl: env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
      // Low batch size so a single trace always triggers a flush
      flushAt: 1,
      flushInterval: 0,
    });
  } catch {
    _client = null;
  }

  return _client;
}

/**
 * Call this before returning from any serverless route/action that uses
 * Langfuse. Waits for all buffered traces to be sent to the API.
 */
export async function flushLangfuse(): Promise<void> {
  try {
    await _client?.flushAsync();
  } catch {
    // Never let an observability flush block or crash the response.
  }
}
