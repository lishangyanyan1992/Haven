/**
 * Langfuse LLM observability client + prompt management.
 *
 * IMPORTANT — serverless flush:
 * Vercel freezes the function immediately after the response is sent.
 * Langfuse's background flush interval never fires in this environment.
 * Always call `await flushLangfuse()` before returning from a route handler
 * or server action that makes AI calls.
 *
 * PROMPT MANAGEMENT:
 * Prompts are fetched from Langfuse at runtime so you can edit them in
 * the Langfuse dashboard without redeploying. Falls back to the hardcoded
 * string if Langfuse is unavailable or the key isn't set.
 *
 * To update a prompt: go to Langfuse → Prompts → edit → publish a new version.
 * The next request will pick it up automatically (cached for 60s).
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
      flushAt: 1,
      flushInterval: 0,
    });
  } catch {
    _client = null;
  }

  return _client;
}

/**
 * Fetch a prompt from Langfuse by name (label: "production").
 * Returns the prompt text, or the fallback string if unavailable.
 * Results are cached in-process for ~60 seconds by the Langfuse SDK.
 */
export async function getPrompt(name: string, fallback: string): Promise<string> {
  const lf = getLangfuseClient();
  if (!lf) return fallback;

  try {
    const prompt = await lf.getPrompt(name, undefined, { label: "production", cacheTtlSeconds: 60 });
    const compiled = prompt.compile();
    return typeof compiled === "string" ? compiled : fallback;
  } catch {
    return fallback;
  }
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
