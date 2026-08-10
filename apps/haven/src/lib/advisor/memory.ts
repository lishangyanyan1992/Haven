/**
 * Long-term memory: facts the user stated, carried across conversations.
 *
 * Release one gave conversations persistence. This is what makes them useful next
 * week: somebody who says "my last day was March 3rd" should not have to say it
 * again, and an Advisor that makes them is the forgetful-stranger failure the
 * whole feature exists to fix.
 *
 * Three rules shape everything here, and each one is a defence against a specific
 * way this feature goes wrong in a tier-4 product.
 *
 * 1. **Store the sentence, never a parsed value.** "March 3rd" is not stored as
 *    2026-03-03. A misparse would become a wrong deadline, permanently, in every
 *    future conversation — and the deadline *is* the question here. Keeping the
 *    user's words means interpretation happens at answer time with the guardrails
 *    applied, exactly as it does for the current turn.
 *
 * 2. **A remembered fact is evidence, not a conclusion.** It goes into the prompt
 *    attributed and dated ("On 8 Aug you said: …"), so the Advisor treats it as
 *    something the user reported rather than as ground truth it may assert. The
 *    current message always outranks it: people's situations change, and the most
 *    recent statement is the most reliable one.
 *
 * 3. **Nothing is remembered invisibly.** Every fact is listed in the UI, and
 *    every one can be removed. A recalled fact the user knew they gave is helpful;
 *    one they did not realise was kept is unsettling, and on this subject matter
 *    that is a trust failure rather than a UX quibble.
 *
 * Extraction is deliberately pattern-based rather than a second model call. It
 * costs nothing, adds no latency to an answer that already takes ~20s, and cannot
 * hallucinate a fact the user never stated — which a summarising model call
 * absolutely can, and would then persist forever.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RememberedFactKind = "employment" | "filing" | "status" | "date";

export interface RememberedFact {
  id: string;
  kind: RememberedFactKind;
  quote: string;
  createdAt: string;
}

/** Facts carried into any one prompt. Bounds both cost and confusion. */
const MAX_FACTS_IN_PROMPT = 6;

/** Facts listed in the UI. */
const MAX_FACTS_LISTED = 24;

/** A sentence longer than this is a paragraph, not a fact. */
const MAX_QUOTE_LENGTH = 240;

/**
 * What counts as a durable fact worth carrying forward.
 *
 * Each pattern targets something a user states once and would otherwise have to
 * repeat: an event with a date, a filing, a change of status. Deliberately narrow.
 * The failure mode to avoid is not "missed a fact" — the user can always restate
 * it — but "remembered something wrong and acted on it for months".
 *
 * Note these run against the user's message only. Nothing the Advisor says is ever
 * remembered as fact: it is not a source about the user's life, and letting its
 * own output feed back into its context is how a small error becomes permanent.
 */
const FACT_PATTERNS: Array<{ kind: RememberedFactKind; pattern: RegExp }> = [
  {
    // Employment events. The 60-day clock starts here, so this is the single most
    // valuable thing to carry forward.
    kind: "employment",
    pattern:
      /\b(my (last (working )?day|termination date|final day)\b|i (was|got) (laid off|terminated|fired|let go)|my last day (was|is)|(was|got) made redundant|i resigned|my notice period)\b/i
  },
  {
    // Filings and approvals: dated events the user knows and the profile may not.
    kind: "filing",
    pattern:
      /\b(my (i-?140|i-?485|i-?131|i-?765|perm|h-?1b petition|advance parole)\b.{0,40}\b(was|got|is)\b.{0,20}\b(approved|denied|filed|receipted|pending|withdrawn)|we filed (my|the)|my (employer|attorney|lawyer) filed|i filed my)\b/i
  },
  {
    // Changes of status or category, which silently invalidate a stale profile.
    kind: "status",
    pattern:
      /\b(i (am now|switched to|changed to|moved to|am on)\b.{0,30}\b(h-?1b|h-?4|f-?1|o-?1|l-?1|b-?2|opt|stem opt|ead|green card)|my (status|visa|category) (changed|is now)|i (started|start) (at|with) (a )?new (employer|company|job))\b/i
  },
  {
    // A bare date the user attaches to themselves. Weakest signal, so it is last
    // and its quote still carries the surrounding sentence for context.
    kind: "date",
    pattern:
      /\b(my|our) [a-z0-9 -]{0,30}\b(date|deadline|expires?|expiry|expiration|valid until|runs out)\b/i
  }
];

/** Sentences that look like a fact but are the user asking, not telling. */
const QUESTION_LIKE = /^(what|when|how|why|can|could|should|would|do|does|did|is|are|will|if)\b|\?\s*$/i;

/**
 * Pull durable facts out of one user message.
 *
 * Splits into sentences first so a stored quote is one statement rather than a
 * whole paragraph, and skips anything phrased as a question — "when is my last
 * day?" states nothing, and remembering it as though it did would put a
 * non-fact in front of every future answer.
 */
export function extractFacts(message: string): Array<{ kind: RememberedFactKind; quote: string }> {
  const sentences = message
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && sentence.length <= MAX_QUOTE_LENGTH);

  const found: Array<{ kind: RememberedFactKind; quote: string }> = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    if (QUESTION_LIKE.test(sentence)) continue;

    for (const { kind, pattern } of FACT_PATTERNS) {
      if (!pattern.test(sentence)) continue;
      const key = sentence.toLowerCase();
      if (seen.has(key)) break;
      seen.add(key);
      found.push({ kind, quote: sentence });
      // One kind per sentence: the first matching pattern is the most specific.
      break;
    }
  }

  return found;
}

/**
 * Store any facts in this message.
 *
 * Silent on failure, like conversation persistence: the user has already read
 * their answer, and failing it over a memory write would report an error on a
 * response that succeeded. Conflicts are ignored so restating a fact is a no-op
 * rather than an error.
 */
export async function rememberFactsFrom(input: {
  userId: string;
  threadId: string;
  message: string;
}): Promise<void> {
  const facts = extractFacts(input.message);
  if (facts.length === 0) return;

  try {
    const admin = createSupabaseAdminClient() as any;
    await admin
      .from("advisor_remembered_facts")
      .upsert(
        facts.map((fact) => ({
          user_id: input.userId,
          thread_id: input.threadId,
          kind: fact.kind,
          quote: fact.quote
        })),
        // quote_hash is a stored generated column, so this names real columns.
        { onConflict: "user_id,quote_hash", ignoreDuplicates: true }
      );
  } catch {
    // Intentionally silent — see the doc comment.
  }
}

/** A user's live remembered facts, newest first. */
export async function listFacts(userId: string, limit = MAX_FACTS_LISTED): Promise<RememberedFact[]> {
  const admin = createSupabaseAdminClient() as any;

  const { data, error } = await admin
    .from("advisor_remembered_facts")
    .select("id, kind, quote, created_at")
    .eq("user_id", userId)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Unable to load what Haven remembers: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    id: row.id as string,
    kind: row.kind as RememberedFactKind,
    quote: row.quote as string,
    createdAt: row.created_at as string
  }));
}

/**
 * Forget one fact.
 *
 * Marks rather than deletes so the extractor does not immediately re-learn it from
 * the conversation it came from — a "forget this" that reappears next turn is
 * worse than no control at all. The row is removed with the account.
 */
export async function forgetFact(userId: string, factId: string): Promise<boolean> {
  const admin = createSupabaseAdminClient() as any;

  const { data, error } = await admin
    .from("advisor_remembered_facts")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", factId)
    .eq("user_id", userId)
    .is("dismissed_at", null)
    .select("id");

  if (error) {
    throw new Error(`Unable to remove that: ${error.message}`);
  }

  return (data ?? []).length > 0;
}

/**
 * Render facts for the prompt.
 *
 * Attributed and dated so the Advisor treats them as reported by the user rather
 * than as established fact, and explicitly outranked by the current message —
 * people's circumstances change, and the newest statement is the reliable one. The
 * instruction to say when it uses one is what keeps the memory visible in the
 * answer rather than quietly shaping it.
 */
export function renderFactsForPrompt(facts: RememberedFact[]): string[] {
  if (facts.length === 0) return [];

  const lines = facts.slice(0, MAX_FACTS_IN_PROMPT).map((fact) => {
    const when = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC"
    }).format(new Date(fact.createdAt));
    return `On ${when} the user said: "${fact.quote}"`;
  });

  return [
    ...lines,
    "These are things the user told you in earlier conversations, not verified facts. If anything in the current message contradicts one, the current message wins and the older statement is out of date. When one of these materially changes your answer, say which one you used, so the user can correct you."
  ];
}
