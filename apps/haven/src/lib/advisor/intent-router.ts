/**
 * Intent router — work out what the user means, not which words they used.
 *
 * WHY THIS EXISTS
 *
 * Routing is done today by matching keywords: roughly forty job-loss patterns, a
 * travel list, a CSPA pattern, and so on. Topics decide which official sources are
 * retrieved and which safety guardrails fire, so a missed keyword is not a cosmetic
 * problem — it silently produces a confident answer built from the wrong material,
 * with no error anywhere.
 *
 * That failure has now been found repeatedly, always the same shape:
 *
 *   "My position was affected in the restructuring"  no topic, no layoff guardrails
 *   "What do you know about me?"                     only matched if it said "Haven"
 *   "Can I switch to H-4 while I look?"              right topic, wrong sources
 *
 * Each was fixed by widening a pattern. The job-loss list has been widened five
 * separate times that way. Every fix is correct and none of them addresses the
 * cause, which is that a keyword list can only ever cover the phrasings somebody
 * already thought of.
 *
 * WHAT THIS DOES INSTEAD
 *
 * One model call that reads the question and fills in a fixed form: topic,
 * confidence, which facts the user actually supplied, which facts are missing,
 * what safety points the answer must carry. Prose is never returned — the output is
 * a typed object, so it can be validated, traced, compared and asserted.
 *
 * KEYWORDS ARE NOT BEING DELETED
 *
 * They stay, and they run alongside. Semantic classification has its own failure
 * mode — it can be confidently wrong in ways a literal match never is — so the
 * design is that either signal can raise a safety topic and both must miss before
 * a user loses protection. That is strictly safer than either alone, and it is the
 * whole reason this is worth doing rather than a straight swap.
 *
 * SHADOW MODE
 *
 * Nothing here changes what a user sees. `classifyIntent` is called alongside the
 * existing router and the two results are compared onto the trace. The point of
 * the first phase is to find out how often they disagree, and on what, before any
 * behaviour depends on it. A router that looked right in review and disagreed with
 * production on a fifth of real traffic would be a much worse problem than the one
 * being solved.
 */

import OpenAI from "openai";

import { env } from "@/lib/env";
import { TOPIC_BUCKETS, type TopicBucket } from "@/lib/advisor/topics";

/** Facts that change an answer, and that only the user can supply. */
export const FACT_IDS = [
  "last_day_of_work",
  "i94_expiry",
  "petition_filed_date",
  "priority_date",
  "i140_approved",
  "i485_filed",
  "i485_pending_180_days",
  "advance_parole_approved",
  "ead_in_hand",
  "child_date_of_birth",
  "denial_notice_date"
] as const;

/** Safety points an answer must carry, by situation. */
export const SAFETY_IDS = [
  "no_unauthorized_work",
  "grace_period_cap",
  "lca_not_protection",
  "portability_needs_filing",
  "file_before_status_expires",
  "i485_abandonment",
  "pending_ap_not_permission",
  "pending_opt_not_work_authorization",
  "cspa_no_calculation",
  "deadline_runs_from_notice",
  "immediate_counsel"
] as const;

export type FactId = (typeof FACT_IDS)[number];
export type SafetyId = (typeof SAFETY_IDS)[number];

export interface IntentRead {
  topics: TopicBucket[];
  confidence: "high" | "low";
  /** Facts the user stated in their own words. Never inferred from the profile. */
  factsStated: FactId[];
  /** Facts that would change the answer and were not supplied. */
  factsMissing: FactId[];
  requiredSafety: SafetyId[];
  /** A false belief in the question that should be corrected before answering. */
  premiseToCorrect: string | null;
  /** Set when the question is not about employment-based immigration at all. */
  outOfDomain: boolean;
}

/**
 * The router is deliberately a separate knob from the answer model.
 *
 * This call is short, structured and on the critical path for every question, so
 * it wants a fast cheap model; generation wants the best available. Tying them
 * together would mean a routing change every time the answer model is tuned.
 */
export function getRouterModel() {
  return env.OPENAI_ADVISOR_ROUTER_MODEL ?? env.OPENAI_ADVISOR_MODEL ?? "gpt-5-mini";
}

const SYSTEM_PROMPT = [
  "You classify questions for a US employment-based immigration assistant. You never answer them.",
  "Read what the person means, not which words they used. People describe job loss as 'my position was affected in the restructuring', 'they let me go', 'I was benched', 'I put down my papers'. All of those are job loss.",
  "",
  "Return topics that genuinely apply. An empty list is correct when the question is not about immigration.",
  "",
  "factsStated: only facts the person supplied in this conversation. Never guess, and never include a fact merely because it is typical of the situation.",
  "factsMissing: facts that would change the answer and were not supplied. Empty is fine when the question is general.",
  "",
  "requiredSafety: the points an answer must carry to be safe. Be generous here — an unnecessary safety point costs a sentence, a missing one can cost someone their immigration status.",
  "",
  "premiseToCorrect: set this when the question assumes something false, for example that unpaid work preserves H-1B status, or that a pending advance parole request permits travel. Otherwise null.",
  "",
  "outOfDomain: true only when the question has nothing to do with US employment-based immigration."
].join("\n");

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["topics", "confidence", "factsStated", "factsMissing", "requiredSafety", "premiseToCorrect", "outOfDomain"],
  properties: {
    topics: { type: "array", items: { type: "string", enum: [...TOPIC_BUCKETS] } },
    confidence: { type: "string", enum: ["high", "low"] },
    factsStated: { type: "array", items: { type: "string", enum: [...FACT_IDS] } },
    factsMissing: { type: "array", items: { type: "string", enum: [...FACT_IDS] } },
    requiredSafety: { type: "array", items: { type: "string", enum: [...SAFETY_IDS] } },
    premiseToCorrect: { type: ["string", "null"] },
    outOfDomain: { type: "boolean" }
  }
} as const;

let client: OpenAI | null | undefined;

function getClient() {
  if (client === undefined) {
    client = env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
  }
  return client;
}

/**
 * Classify one turn. Returns null rather than throwing.
 *
 * Null is a real answer here, not an error swallowed. In shadow mode a failed
 * classification must cost the user nothing, and once this router is load-bearing
 * the caller still has the keyword result to fall back on. A router that could
 * take the Advisor down would be a worse product than the keyword matching it
 * replaces, however much better it classifies.
 */
export async function classifyIntent(input: {
  content: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  timeoutMs?: number;
}): Promise<IntentRead | null> {
  const openai = getClient();
  if (!openai) return null;

  // The previous user turn only. A follow-up rarely repeats the signal that
  // classified the original question — "what should I file first?" means nothing
  // alone — and the existing keyword router already looks back exactly one turn,
  // so the two see the same context and the comparison stays honest.
  const previousUserTurn = [...(input.history ?? [])].reverse().find((m) => m.role === "user");
  const userPrompt = [
    previousUserTurn ? `Previous question from the same person: ${previousUserTurn.content}` : null,
    `Current question: ${input.content}`
  ]
    .filter(Boolean)
    .join("\n\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 8000);

  try {
    // `reasoning_effort` is not in the SDK's non-streaming param type yet, so the
    // object is asserted rather than the call. Asserting the call instead widened
    // the return type to include the streaming union and lost `choices`.
    const params = {
      model: getRouterModel(),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "intent_read", strict: true, schema: SCHEMA }
      },
      // Measured, not assumed: the same call takes 10.2s at the default reasoning
      // effort and 0.9s at minimal, with identical classifications on every case
      // tested. Ten seconds on top of an answer that already runs ~20s would have
      // made routing the most expensive step in the pipeline, to decide something
      // a regex decides instantly.
      //
      // Minimal suits the shape of this task rather than being a corner cut.
      // Classification into a fixed enum is recognition, not deliberation, so
      // there is no multi-step reasoning for the effort to buy. If a later schema
      // does need judgement — apportioning facts, say — this is the first knob to
      // revisit, and check:intent-router is what would show it.
      reasoning_effort: "minimal"
    } as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming;

    const response = await openai.chat.completions.create(params, { signal: controller.signal });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw) as IntentRead;

    // Validated rather than trusted. `strict: true` is enforced by the API, but a
    // model swap or a schema drift would otherwise put unchecked strings into the
    // values that decide which safety guardrails fire.
    const topicSet = new Set<string>(TOPIC_BUCKETS);
    const factSet = new Set<string>(FACT_IDS);
    const safetySet = new Set<string>(SAFETY_IDS);

    return {
      topics: (parsed.topics ?? []).filter((t): t is TopicBucket => topicSet.has(t)),
      confidence: parsed.confidence === "high" ? "high" : "low",
      factsStated: (parsed.factsStated ?? []).filter((f): f is FactId => factSet.has(f)),
      factsMissing: (parsed.factsMissing ?? []).filter((f): f is FactId => factSet.has(f)),
      requiredSafety: (parsed.requiredSafety ?? []).filter((s): s is SafetyId => safetySet.has(s)),
      premiseToCorrect: typeof parsed.premiseToCorrect === "string" ? parsed.premiseToCorrect : null,
      outOfDomain: parsed.outOfDomain === true
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export type RouterComparison = {
  agreed: boolean;
  /** Topics the keyword router found and the model missed. */
  onlyKeyword: TopicBucket[];
  /** Topics the model found and the keyword router missed — the reason for this work. */
  onlyModel: TopicBucket[];
  /** Union of both, which is what a live implementation would act on. */
  union: TopicBucket[];
  confidence: "high" | "low";
  requiredSafety: SafetyId[];
};

/**
 * Compare the two routers.
 *
 * `union` is recorded because it is what the live design would use: either signal
 * may raise a topic, and both must miss before a user loses a guardrail. Reporting
 * it during the shadow phase shows what coverage would be *gained* before anything
 * depends on it.
 */
export function compareRouters(keywordTopics: TopicBucket[], read: IntentRead): RouterComparison {
  const keyword = new Set(keywordTopics);
  const model = new Set(read.topics);

  return {
    agreed: keywordTopics.length === read.topics.length && keywordTopics.every((t) => model.has(t)),
    onlyKeyword: keywordTopics.filter((t) => !model.has(t)),
    onlyModel: read.topics.filter((t) => !keyword.has(t)),
    union: [...new Set([...keywordTopics, ...read.topics])],
    confidence: read.confidence,
    requiredSafety: read.requiredSafety
  };
}
