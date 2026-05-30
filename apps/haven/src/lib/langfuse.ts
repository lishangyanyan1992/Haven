/**
 * Langfuse LLM observability — two separate projects:
 *
 *   haven-advisor        → LANGFUSE_SECRET_KEY / LANGFUSE_PUBLIC_KEY
 *   haven-email-extraction → LANGFUSE_EMAIL_SECRET_KEY / LANGFUSE_EMAIL_PUBLIC_KEY
 *
 * IMPORTANT — serverless flush:
 * Vercel freezes the function immediately after the response is sent.
 * Always call `await flushLangfuse()` before returning from any route
 * handler or server action that makes AI calls.
 *
 * PROMPT MANAGEMENT:
 * Prompts are fetched from Langfuse at runtime (cached 60s) so you can
 * edit them in the dashboard without redeploying.
 */
import { Langfuse } from "langfuse";

import { env } from "@/lib/env";

// ── Advisor client ────────────────────────────────────────────────────────────

let _advisor: Langfuse | null = null;
let _advisorAttempted = false;

export function getLangfuseClient(): Langfuse | null {
  if (_advisorAttempted) return _advisor;
  _advisorAttempted = true;

  if (!env.LANGFUSE_SECRET_KEY || !env.LANGFUSE_PUBLIC_KEY) return null;

  try {
    _advisor = new Langfuse({
      secretKey: env.LANGFUSE_SECRET_KEY,
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      baseUrl: env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
      flushAt: 1,
      flushInterval: 0,
    });
  } catch {
    _advisor = null;
  }

  return _advisor;
}

// ── Email extraction client ───────────────────────────────────────────────────

let _email: Langfuse | null = null;
let _emailAttempted = false;

export function getEmailLangfuseClient(): Langfuse | null {
  if (_emailAttempted) return _email;
  _emailAttempted = true;

  if (!env.LANGFUSE_EMAIL_SECRET_KEY || !env.LANGFUSE_EMAIL_PUBLIC_KEY) return null;

  try {
    _email = new Langfuse({
      secretKey: env.LANGFUSE_EMAIL_SECRET_KEY,
      publicKey: env.LANGFUSE_EMAIL_PUBLIC_KEY,
      baseUrl: env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
      flushAt: 1,
      flushInterval: 0,
    });
  } catch {
    _email = null;
  }

  return _email;
}

// ── Prompt management ─────────────────────────────────────────────────────────

/**
 * Fetch a prompt from a Langfuse project by name (label: "production").
 * Falls back to the hardcoded string if Langfuse is unavailable.
 * Cached for 60s — edits in the dashboard take effect within 1 minute.
 */
export async function getPrompt(
  client: Langfuse | null,
  name: string,
  fallback: string
): Promise<string> {
  if (!client) return fallback;

  try {
    const prompt = await client.getPrompt(name, undefined, { label: "production", cacheTtlSeconds: 60 });
    const compiled = prompt.compile();
    return typeof compiled === "string" ? compiled : fallback;
  } catch {
    return fallback;
  }
}

// ── Flush ─────────────────────────────────────────────────────────────────────

/**
 * Flush all pending traces for both clients before the serverless function exits.
 */
export async function flushLangfuse(): Promise<void> {
  try {
    await Promise.all([
      _advisor?.flushAsync(),
      _email?.flushAsync(),
    ]);
  } catch {
    // Never let observability block or crash the response.
  }
}
