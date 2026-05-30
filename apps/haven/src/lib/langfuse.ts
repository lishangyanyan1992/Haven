/**
 * Langfuse LLM observability client.
 *
 * All AI calls (advisor answers, embeddings, moderation, email extraction)
 * are traced through this singleton so token usage, latency, and prompt
 * quality are visible in the Langfuse dashboard.
 *
 * The client is a no-op when LANGFUSE_SECRET_KEY is not set (local dev,
 * CI) — no errors, no data sent, no behaviour change.
 *
 * Types are intentionally loose (any) so the file compiles before
 * `npm install` runs and the langfuse package is present on disk.
 */
import { env } from "@/lib/env";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;
let _attempted = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLangfuseClient(): any {
  if (_attempted) return _client;
  _attempted = true;

  if (!env.LANGFUSE_SECRET_KEY || !env.LANGFUSE_PUBLIC_KEY) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Langfuse } = require("langfuse");
    _client = new Langfuse({
      secretKey: env.LANGFUSE_SECRET_KEY,
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      baseUrl: env.LANGFUSE_HOST ?? "https://cloud.langfuse.com",
      flushAt: 10,
      flushInterval: 5000,
    });
  } catch {
    // SDK not installed or initialisation failed — degrade silently.
    _client = null;
  }

  return _client;
}
