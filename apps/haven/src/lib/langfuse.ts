/**
 * Langfuse LLM observability — two separate projects:
 *
 *   haven-advisor        → LANGFUSE_SECRET_KEY / LANGFUSE_PUBLIC_KEY
 *   haven-email-extraction → LANGFUSE_EMAIL_SECRET_KEY / LANGFUSE_EMAIL_PUBLIC_KEY
 *   haven-story-ingestion → LANGFUSE_STORY_SECRET_KEY / LANGFUSE_STORY_PUBLIC_KEY
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
import { Langfuse, type LangfusePromptClient } from "langfuse";

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

// ── Story ingestion client ───────────────────────────────────────────────────

let _story: Langfuse | null = null;
let _storyAttempted = false;

export function getStoryLangfuseClient(): Langfuse | null {
  if (_storyAttempted) return _story;
  _storyAttempted = true;

  if (!env.LANGFUSE_STORY_SECRET_KEY || !env.LANGFUSE_STORY_PUBLIC_KEY) return null;

  try {
    _story = new Langfuse({
      secretKey: env.LANGFUSE_STORY_SECRET_KEY,
      publicKey: env.LANGFUSE_STORY_PUBLIC_KEY,
      baseUrl: env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
      flushAt: 1,
      flushInterval: 0,
    });
  } catch {
    _story = null;
  }

  return _story;
}

// ── Prompt management ─────────────────────────────────────────────────────────

/**
 * Resolved prompt: the compiled text plus the Langfuse prompt object (when
 * available) so generations can be linked to a prompt version for analytics.
 */
export type ResolvedPrompt = {
  text: string;
  prompt?: LangfusePromptClient;
};

type PromptSeed = {
  fallback: string;
  name: string;
};

const SEEDED_PROMPTS = new WeakMap<Langfuse, Set<string>>();

/**
 * Fetch a prompt from a Langfuse project by name (label: "production").
 * Falls back to the hardcoded string if Langfuse is unavailable.
 * Cached for 60s — edits in the dashboard take effect within 1 minute.
 *
 * Returns both the compiled text and the prompt object. Pass `prompt` into
 * `.generation({ prompt })` so Langfuse links the call to its prompt version
 * (enables per-version cost/latency/score comparison in the dashboard).
 */
export async function getPrompt(
  client: Langfuse | null,
  name: string,
  fallback: string
): Promise<ResolvedPrompt> {
  if (!client) return { text: fallback };

  try {
    const prompt = await client.getPrompt(name, undefined, { label: "production", cacheTtlSeconds: 60 });
    const compiled = prompt.compile();
    return { text: typeof compiled === "string" ? compiled : fallback, prompt };
  } catch {
    return { text: fallback };
  }
}

/**
 * Ensure a text prompt exists in Langfuse and return it.
 * If the prompt is missing in the project, seed a production-labeled version
 * from the fallback text so prompt management becomes visible immediately.
 */
export async function getOrCreatePrompt(
  client: Langfuse | null,
  name: string,
  fallback: string
): Promise<ResolvedPrompt> {
  if (!client) return { text: fallback };

  const cache = SEEDED_PROMPTS.get(client) ?? new Set<string>();
  if (!SEEDED_PROMPTS.has(client)) {
    SEEDED_PROMPTS.set(client, cache);
  }

  const resolved = await getPrompt(client, name, fallback);
  if (resolved.prompt || cache.has(name)) {
    return resolved;
  }

  try {
    const created = await client.createPrompt({
      labels: ["production"],
      name,
      prompt: fallback,
      type: "text"
    });

    cache.add(name);
    const compiled = created.compile();
    return { text: typeof compiled === "string" ? compiled : fallback, prompt: created };
  } catch {
    return resolved;
  }
}

export async function ensurePrompts(
  client: Langfuse | null,
  prompts: PromptSeed[]
): Promise<void> {
  if (!client || prompts.length === 0) return;

  await Promise.all(
    prompts.map(async ({ name, fallback }) => {
      await getOrCreatePrompt(client, name, fallback);
    })
  );
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
      _story?.flushAsync(),
    ]);
  } catch {
    // Never let observability block or crash the response.
  }
}
