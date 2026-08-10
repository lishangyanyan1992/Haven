import { cache } from "react";
import OpenAI from "openai";

import { env, hasSupabaseEnv } from "@/lib/env";
import { flushLangfuse, getLangfuseClient, getPrompt } from "@/lib/langfuse";
import type { LangfuseSpanClient, LangfuseTraceClient } from "langfuse";
import { getSnapshot } from "@/lib/repositories/case-compass";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type {
  AdvisorAnswerPayload,
  AdvisorCitation,
  AdvisorMessage,
  AdvisorUserContext,
  CommunityAdviceSummary,
  Concern,
  HavenWorkspaceSnapshot,
  KnowledgeChunk
} from "@/types/domain";
import { advisorRespondSchema } from "@/lib/advisor/schema";
import { getCaseOutcomeStats, renderStatsForPrompt, type CaseSegmentFilters } from "@/lib/advisor/case-stats";
import {
  buildFallbackCommunitySummaries,
  estimateTokenCount,
  getSourceHash,
  trustedKnowledgeDocuments,
  trustedKnowledgeSources
} from "@/lib/advisor/source-corpus";
import type { TopicBucket } from "@/lib/advisor/topics";
import { guardrailText, resolveGuardrails } from "@/lib/advisor/guardrail-registry";
import { buildThreadState, type ThreadState, type TurnResolution } from "@/lib/advisor/thread-state";
import { listThreads, persistExchange, type AdvisorThreadSummary } from "@/lib/advisor/threads";
import { listFacts, rememberFactsFrom, renderFactsForPrompt, type RememberedFact } from "@/lib/advisor/memory";
import { renderLayoffOptionsForPrompt } from "@/lib/advisor/layoff-options";
import {
  getLiveBulletinSnapshot,
  renderBulletinFreshnessForPrompt,
  renderBulletinPositionForPrompt,
  type LiveBulletinSnapshot
} from "@/lib/advisor/bulletin-live";

type RetrievedKnowledgeChunk = KnowledgeChunk & { documentId?: string };
type RetrievedCommunitySummary = CommunityAdviceSummary;

// A Langfuse parent observation — either the trace itself or a span — that
// child spans/generations can be nested under for true agent-to-agent lineage.
type LangfuseParent = LangfuseTraceClient | LangfuseSpanClient;

type AdvisorIdentity = {
  id: string;
  email: string;
  fullName: string;
  isMock: boolean;
};

export type AdvisorUsage = {
  limit: number;
  used: number;
  remaining: number;
  renewalLabel: string;
  nextRenewalAt: string | null;
};

const ADVISOR_CONVERSATION_LIMIT = 5;
const ADVISOR_CONVERSATION_WINDOW_HOURS = 24;

class AdvisorRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdvisorRateLimitError";
  }
}

function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

export const ADVISOR_DEFAULT_MODEL = "gpt-5-mini";

// OPENAI_ADVISOR_MODEL first: OPENAI_CHAT_MODEL is shared with email extraction
// and community drafting, which deliberately run a cheaper model. Reading only
// the shared variable meant that setting it for those features silently moved
// the advisor off its intended model — which is exactly what local .env.local
// was doing, so every local eval measured a different model than production.
function getChatModel() {
  return env.OPENAI_ADVISOR_MODEL ?? env.OPENAI_CHAT_MODEL ?? ADVISOR_DEFAULT_MODEL;
}

function getEmbeddingModel() {
  return env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
}

/**
 * Today's date, for the prompt.
 *
 * The Advisor had no idea what day it was. Nothing in the system prompt, the user
 * prompt, or any context block carried a date — while the layoff guardrail
 * instructs it to "calculate the rough timeline and say what must be filed before
 * day 60", and the bulletin guardrail turns on which month USCIS is accepting.
 * Deadline arithmetic with no reference point is guesswork dressed as arithmetic.
 *
 * UTC is stated explicitly rather than silently assumed. The user's own timezone is
 * not available server-side today; for a 60-day window a day of drift does not
 * change the advice, and the answer always hands the exact date back to counsel.
 */
function todayForPrompt() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(new Date());
}

function formatAdvisorRenewal(msUntilRenewal: number | null) {
  if (msUntilRenewal == null) return "fully available";
  if (msUntilRenewal <= 60000) return "renews in under 1m";

  const totalMinutes = Math.ceil(msUntilRenewal / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) {
    return `renews in ${minutes}m`;
  }

  if (minutes === 0) {
    return `renews in ${hours}h`;
  }

  return `renews in ${hours}h ${minutes}m`;
}

function asPgVector(input: number[]) {
  return `[${input.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreOverlap(query: string, text: string) {
  const queryTokens = new Set(tokenize(query));
  const textTokens = new Set(tokenize(text));
  let score = 0;

  queryTokens.forEach((token) => {
    if (textTokens.has(token)) score += 1;
  });

  return score;
}

// Users describe losing a job many ways, and most of ours are not writing in a
// first language. Gating the layoff path on "laid off" alone silently dropped the
// guardrails, the safety addendum, the grace-period math, the community stats AND
// the official-source retrieval for anyone who wrote "terminated", "made
// redundant", or "let go" — the phrasings standard in Indian and British English,
// which is most of the user base. See CD-4.1..4.6 in
// docs/advisor-chatbot/conversation-design-requirements.md.
//
// Every layoff gate derives from this one pattern so they cannot drift apart
// again. Over-triggering is the intended failure mode: an extra safety warning
// costs a few tokens, a missing one can cost someone their status.
const JOB_LOSS_TERMS = [
  "laid[- ]?off",
  "layoffs?",
  "terminat(ed|ion)",
  // Object pronoun is optional and the verb may be passive or progressive. The
  // earlier form required "let ME go", so the active voice matched while
  // "I have been let go" and "they are letting me go" did not -- and the passive
  // is the commoner way people say it. The dialect fixture used the one form that
  // matched, so the test certified coverage that was not there.
  "let (me|him|her|them|us) go",
  "(been|being|was|were|got) let go",
  "letting (me|him|her|them|us) go",
  "let go (from|by|of)",
  "\\bfired\\b",
  "made redundant",
  "redundanc(y|ies)",
  "retrench(ed|ment)",
  "(position|role|job|team)s? (was |were |been )?(eliminated|cut)",
  "\\brifs?\\b",
  "riffed",
  "reduction in force",
  "severance",
  // Allow words between the possessive and "job" ("lost my H-1B job") and cover
  // the plural. adv-h1b-layoff-005 -- one of the ten regression cases -- missed
  // the gate entirely because of the intervening "H-1B", and survived only via
  // the incidental word "LCA" in a secondary keyword list.
  "(lost|losing|lose) (my|his|her|their|our)( [a-z0-9-]+){0,3} jobs?",
  "(lost|losing) (my|his|her|their|our) (position|role|employment)",
  "job loss",
  "downsiz(ed|ing)",
  "no longer employed",
  "employment (ended|was terminated)",
  "end of employment",
  "contract (ended|expired|was terminated|is not being renewed|not renewed)",
  "separated from (my |the )?(company|employer)",
  // Added after a review found the first pass still missed the phrasings most
  // common among the largest user segment. "Benched" and "put down (my) papers"
  // are standard Indian-English/IT-consultancy usage, and missing them meant the
  // people most likely to need the layoff guardrails were the least likely to get
  // them.
  "furlough(ed|ing)?",
  "benched",
  "on the bench",
  "put down (my |the )?papers",
  "pink slip",
  "warn notice",
  "(visa|h-?1b|petition) (was |been )?(revoked|withdrawn)",
  "(revoked|withdrew) (my |the )?(h-?1b|petition|visa)",
  "last working day",
  "last day (at|of|with|on the job)",
  "(company|employer|office|team|site) (is |are |was |were )?(shutting down|closing|winding down|dissolved)",
  "asked (me |him |her |them )?to (leave|resign)",
  "services are no longer (required|needed)",
  "role (is|was|has been) (going away|eliminated|made redundant)",
  // Resignation is not a phrasing variant but a category gap: a voluntary or
  // pressured exit starts the same 60-day clock and carries the same
  // unauthorized-work exposure, and previously got no guardrails at all.
  "resign(ed|ing|ation)?",
  "(i |we )?quit (my|the) job",
  "stepping down",
  "notice period"
];

const JOB_LOSS_PATTERN = new RegExp(`(${JOB_LOSS_TERMS.join("|")})`);

function mentionsJobLoss(normalized: string) {
  return JOB_LOSS_PATTERN.test(normalized);
}

// Leaving the country with a pending I-485 and no approved advance parole can
// cause USCIS to treat the application as abandoned. That is the second most
// irreversible thing a Haven user can do, and until now the guardrail warning
// about it was gated on the words "travel", "advance parole", "AP", "I-131",
// "visa stamp" or "reentry" — the vocabulary of someone who already knows the
// rule. The people who most need the warning describe it the way anyone would:
// "I need to fly to Delhi for my father's funeral." All three of the natural
// phrasings tested were silent.
//
// Worse, the pattern was copied by hand into four places and had already drifted:
// the selection copy was missing "reentry", and the retrieval copy was missing
// "ap". A user could therefore match one gate and lose another. Everything now
// derives from this one definition, as the layoff gates do.
//
// The old bare "ap" alternation had no word boundary, so it matched inside
// "happens", "paperwork" and "capital" — the gate fired on unrelated questions
// and missed the real ones. \bap\b fixes both halves.
//
// Over-triggering is the intended failure mode, exactly as for job loss: an extra
// advance-parole paragraph costs a few tokens, a missing one can cost someone a
// green card application they have waited years for.
const TRAVEL_TERMS = [
  "travell?(ing|ed)?",
  "advance parole",
  "\\bap\\b",
  "i-?131",
  "visa stamp",
  "stamping",
  "re-?entry",
  "re-?enter(ing)?",
  "\\bfly(ing)?\\b",
  "\\bflight\\b",
  "\\bflew\\b",
  "leav(e|ing) (the )?(u\\.?s\\.?a?|us|country|states)",
  "go(ing)? (back )?(home|abroad|overseas)",
  "went (back )?home",
  "\\bback home\\b",
  "(out|outside) of the (country|u\\.?s\\.?a?|us|states)",
  "outside the (country|u\\.?s\\.?a?|us|states)",
  "\\babroad\\b",
  "\\boverseas\\b",
  "\\btrip\\b",
  "vacation",
  "visit (my |his |her |their |our )?(family|parents|mom|mum|dad|mother|father|home|india|china)",
  // Bereavement and family events are the commonest reason someone travels against
  // their own interest, and the commonest way the question gets phrased without any
  // immigration vocabulary in it at all.
  "\\bfuneral\\b",
  "(attend|for|to|going to)( a| my| his| her| their)? wedding",
  "[a-z]+'?s wedding",
  "wedding (in|back|abroad|next)",
  "family emergency",
  "emergency (back |at )home",
  "depart(ure|ing|ed)?",
  "consulate",
  "consular",
  "port of entry",
  "\\bcbp\\b",
  "(come|coming|get) back (to|into) the (u\\.?s\\.?a?|us|states|country)",
  "return to the (u\\.?s\\.?a?|us|states|country)"
];

const TRAVEL_PATTERN = new RegExp(`(${TRAVEL_TERMS.join("|")})`);

/**
 * Does this question involve leaving or re-entering the country?
 *
 * The single definition behind every advance-parole gate: guardrail selection,
 * the mandatory safety addendum, answer normalization, and retrieval boosting.
 */
function mentionsTravel(normalized: string) {
  return TRAVEL_PATTERN.test(normalized);
}

// Split from classifyTopics so callers can tell "matched nothing" apart from
// "matched the default". Without that distinction a follow-up that matches no
// pattern looks identical to a genuine h1b + adjustment-of-status question.
function detectTopics(input: string): Set<TopicBucket> {
  const normalized = input.toLowerCase();
  const topics = new Set<TopicBucket>();

  if (/(h-?1b|specialty occupation|transfer|amendment|cap|grace period)/.test(normalized)) topics.add("h1b");
  if (/(visa bulletin|priority date|dates for filing|final action)/.test(normalized)) topics.add("visa-bulletin");
  if (/\bperm\b|labor certification|flag/.test(normalized)) topics.add("perm");
  if (/(i-485|i485|adjustment of status|adjust status|advance parole|i-131)/.test(normalized)) topics.add("adjustment-of-status");
  if (/(job change|same or similar|ac21|portability)/.test(normalized)) topics.add("job-change");
  if (mentionsJobLoss(normalized) || /(60-day|grace period)/.test(normalized)) topics.add("layoffs");
  if (/(f-?1|opt|stem opt|cpt|day 1 cpt|i-983|sevis|dso|ead card)/.test(normalized)) topics.add("student-status");
  if (/(niw|national interest waiver|eb-?1a|eb-?2 niw|proposed endeavor|dhanasar|self.?petition)/.test(normalized)) topics.add("self-petition");
  if (/(cspa|child status protection|age out|aging out|turns 21|turn 21|sought to acquire)/.test(normalized)) topics.add("cspa");
  if (/(work authorization|employment authorization|unauthorized work|worked without authorization|i-9|ead)/.test(normalized)) topics.add("work-authorization");
  if (/(haven|timeline|dashboard|planner|inbox|community)/.test(normalized)) topics.add("haven-product");

  return topics;
}

const DEFAULT_TOPICS: TopicBucket[] = ["h1b", "adjustment-of-status"];

/**
 * Classify a turn in the context of the one before it.
 *
 * Guardrails, retrieval, case stats and the safety addendum all key off `topics`,
 * and the original single-message classifier only ever read the current message.
 * (That version has been removed: it returned the default without telling the
 * caller it had, which is the CD-13.2 bug, and leaving it next to this one was an
 * invitation to reintroduce it.) A follow-up rarely
 * repeats the signal that classified the original question -- our own layoff
 * chips ("What has to be filed before day 60, and who files it?") match no
 * pattern at all, so tapping one silently dropped every layoff guardrail on the
 * highest-risk question in the product. Note how close it was: the classifier
 * matches "60-day" and the chip says "day 60".
 *
 * Looking back one user turn fixes that without accumulating every topic a long
 * thread has touched. Over-triggering is the intended failure mode here: an extra
 * guardrail costs tokens, a missing one can cost someone their status.
 */
function classifyTopicsWithContext(
  content: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): { topics: TopicBucket[]; currentMatched: boolean; previousMatched: boolean } {
  const current = detectTopics(content);
  const previousUserTurn = [...history].reverse().find((m) => m.role === "user");
  const carried = previousUserTurn ? detectTopics(previousUserTurn.content) : new Set<TopicBucket>();

  const merged = new Set<TopicBucket>([...current, ...carried]);

  // The default is still returned so retrieval has something to work with, but the
  // caller now knows it is a default. Before this, an unrecognised question was
  // indistinguishable from a genuine h1b + adjustment-of-status one, and got the
  // same confident answer (CD-13.2).
  return {
    topics: merged.size > 0 ? Array.from(merged) : DEFAULT_TOPICS,
    currentMatched: current.size > 0,
    previousMatched: carried.size > 0
  };
}

/** Does this text match any topic pattern at all? Used for the miss counter. */
function matchesAnyTopic(text: string): boolean {
  return detectTopics(text).size > 0;
}

export interface AdvisorRoute {
  topics: TopicBucket[];
  guardrailIds: string[];
  currentMatched: boolean;
  previousMatched: boolean;
  /**
   * How this turn resolved. `unmatched` means the streaming path short-circuits to
   * a clarifying question and never reaches generation, so `guardrailIds` is not
   * delivered to anyone. Exposed so a check can tell "guarded" apart from "asked
   * instead of guessing" — they are both safe, and they are not the same thing.
   */
  resolution: TurnResolution;
  /** True when the pending-I-485 profile fact added the adjustment topic. */
  travelAugmented: boolean;
}

/**
 * Everything that decides which guardrails a question receives: topic
 * classification, the profile-derived augmentation, and guardrail selection.
 *
 * This exists as one exported function so that `streamAdvisorResponse` and the
 * regression checks exercise the *same* routing rather than two implementations
 * that agree on the day they are written. That distinction is not theoretical
 * here: the advance-parole gate was four hand-copied regexes that had already
 * drifted apart, and the eval fixture covering it passed against a copy that was
 * not the one production used.
 */
export function routeAdvisorQuestion(input: {
  content: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  /** From the user's Haven profile. */
  i485Filed?: boolean;
}): AdvisorRoute {
  const { content, history = [], i485Filed = false } = input;
  const classification = classifyTopicsWithContext(content, history);
  const normalized = content.toLowerCase();

  // `topics` is DEFAULT_TOPICS when nothing classified — a placeholder so retrieval
  // has something to work with, not a finding. It happens to contain
  // "adjustment-of-status", so testing membership of it to decide whether the
  // profile has something to add would compare against a guess and conclude there
  // was nothing to add. Track the distinction explicitly.
  const usedDefaultTopics = !classification.currentMatched && !classification.previousMatched;

  // Travel carries one user turn back, matching how topics are classified. Without
  // this a narrowing follow-up ("and what if I only go for four days?") kept the
  // topic and lost the guardrail.
  const previousUserTurn = [...history].reverse().find((turn) => turn.role === "user");
  const travelMentioned =
    mentionsTravel(normalized) ||
    (previousUserTurn ? mentionsTravel(previousUserTurn.content.toLowerCase()) : false);

  // Profile-aware augmentation.
  //
  // Broadening the travel vocabulary is only half the fix. Someone who filed an
  // I-485 eight months ago does not say "I-485" when they ask "can I go home for
  // two weeks?" — they have lived with the case long enough that it is background,
  // not foreground. The question then classifies as something else, or as nothing,
  // and the abandonment guardrail never fires even though the travel pattern
  // matched. Haven already knows they filed; a travel question from a user with a
  // pending adjustment is an adjustment-of-status travel question regardless of
  // which words they used.
  const travelAugmented =
    i485Filed &&
    travelMentioned &&
    (usedDefaultTopics || !classification.topics.includes("adjustment-of-status"));

  // When the profile resolves a question the patterns could not, the profile's
  // answer replaces the placeholder rather than joining it — otherwise retrieval
  // spends half its slots on the H-1B chunks the default guessed at, for a question
  // that is entirely about leaving the country.
  const topics: TopicBucket[] =
    travelAugmented && usedDefaultTopics
      ? ["adjustment-of-status"]
      : travelAugmented
        ? [...classification.topics, "adjustment-of-status"]
        : [...classification.topics];

  // An augmented turn counts as matched.
  //
  // "Can I go home for two weeks?" classifies against nothing, so without this it
  // resolves `unmatched` and the user gets the clarifying menu — from a product
  // that has just worked out exactly what they are asking, using their own profile.
  // Answering "I'm not sure what you mean" when you are in fact sure is its own
  // small failure, and here it also costs the abandonment warning: an unmatched
  // turn returns before generation, so the guardrail is selected and never
  // delivered. Recording the match keeps the miss counter honest too — this turn
  // was understood, so it must not push the thread toward the two-strike handoff.
  const currentMatched = classification.currentMatched || travelAugmented;

  return {
    topics,
    guardrailIds: selectGuardrailIds(content, topics, { travelMentioned }),
    currentMatched,
    previousMatched: classification.previousMatched,
    resolution: currentMatched ? "matched" : classification.previousMatched ? "carried" : "unmatched",
    travelAugmented
  };
}

/** Thread-level signals that outlive the sentence the user just typed. */
export interface GuardrailSignals {
  /**
   * Travel was raised in this turn *or* the previous user turn.
   *
   * Topics already look one user turn back, but guardrail selection did not, so a
   * follow-up kept the adjustment-of-status topic and silently lost the
   * advance-parole guardrail: "My I-485 is pending and I want to travel to India"
   * is guarded, and "And what if I only go for four days?" — the same decision,
   * narrowed — was not. This is the same defect the layoff gate was fixed for
   * (the chips say "day 60", the classifier matched "60-day"); it simply had not
   * been rechecked here.
   */
  travelMentioned: boolean;
}

/**
 * Choose which guardrails apply to this question.
 *
 * Returns registry ids rather than prose (CD-13.1). Keeping ids here means a trace
 * records *which* rule fired, and a fixture can assert on that instead of grepping
 * the answer for an English phrase that a prompt edit will quietly change.
 */
function selectGuardrailIds(query: string, topics: TopicBucket[], signals: GuardrailSignals): string[] {
  const normalized = query.toLowerCase();
  const ids: string[] = [];

  if (topics.includes("job-change") && /(ac21|same or similar|portability)/.test(normalized)) {
    ids.push("GR_AC21_PORTABILITY");
  }

  if (topics.includes("visa-bulletin") || /(dates for filing|final action|priority date|i-485)/.test(normalized)) {
    ids.push("GR_VISA_BULLETIN_FILING_CHART");
  }

  if (topics.includes("adjustment-of-status") && signals.travelMentioned) {
    ids.push("GR_I485_TRAVEL");
  }

  if ((topics.includes("h1b") || topics.includes("layoffs")) && (mentionsJobLoss(normalized) || /(grace period|transfer|paycheck|last day)/.test(normalized))) {
    // The hard rules and the option menu were one guardrail. Split so the rules can
    // repeat on every layoff turn while the menu is delivered once (CD-13.4).
    ids.push("GR_LAYOFF_SAFETY_RULES", "GR_LAYOFF_OPTION_MENU");
  }

  if (topics.includes("student-status") && /(opt|ead|work|employment|job starts|begin work|start work)/.test(normalized)) {
    ids.push("GR_OPT_WORK_AUTHORIZATION");
  }

  if (topics.includes("student-status") && /(cpt|day 1 cpt)/.test(normalized)) {
    ids.push("GR_CPT_DAY1");
  }

  if (topics.includes("cspa")) {
    ids.push("GR_CSPA_AGE_OUT");
  }

  if (topics.includes("self-petition") && /(denied|denial|refil|re-file|appeal|motion|vague|proposed endeavor)/.test(normalized)) {
    ids.push("GR_NIW_DENIAL");
  }

  if (topics.includes("work-authorization") && /(misrepresent|hide|conceal|does not notice|without authorization|unauthorized work)/.test(normalized)) {
    ids.push("GR_UNAUTHORIZED_WORK");
  }

  return ids;
}

// Follow-ups were declared in the payload but never populated, so the UI had
// nothing to show. They are built deterministically rather than with a second
// model call: the advisor already runs ~20s, and a follow-up that invents a
// premise is worse than none. They double as the cheapest repair affordance
// (CD-2.8) and as models of a fact-rich question (CD-3.3), so each one names the
// fact it needs rather than being a bare topic label.
const FOLLOW_UPS_BY_TOPIC: Partial<Record<TopicBucket, string[]>> = {
  layoffs: [
    // These are sent verbatim when tapped, so they can never contain a placeholder
    // for the user to fill in — a chip reading "[date]" ships "[date]" to the model.
    "How do I work out my exact deadline?",
    "What has to be filed before day 60, and who files it?",
    "What should I ask an immigration attorney about my options this week?"
  ],
  h1b: [
    "What does a new employer have to file, and by when?",
    "How do I tell the difference between staying in status and being allowed to work?"
  ],
  "visa-bulletin": [
    "How do Final Action Dates and Dates for Filing differ for my category?",
    "Where do I check which chart USCIS is accepting this month?"
  ],
  "adjustment-of-status": [
    "What are my options if I need to travel before advance parole is approved?",
    "What is the difference between my visa stamp, my status, and advance parole?"
  ],
  "job-change": [
    "What does AC21 portability actually require in my situation?",
    "What counts as a same-or-similar role?"
  ],
  "student-status": [
    "When exactly am I allowed to start working?",
    "What should I confirm with my DSO before I accept this offer?"
  ],
  "self-petition": [
    "What should I ask counsel to review in the denial notice?",
    "What evidence would make a proposed endeavor more specific?"
  ],
  cspa: [
    "What documents should I gather before speaking to an attorney?",
    "Which dates does a CSPA age calculation depend on?"
  ],
  "work-authorization": [
    "What are the safe next steps to take right now?",
    "What should I disclose to an attorney, and how soon?"
  ],
  "haven-product": [
    "What should I add to my Haven profile to get a sharper answer?",
    "Which dates in my Haven timeline matter most in the next six months?"
  ]
};

const GENERIC_FOLLOW_UPS = [
  "What information do you still need to answer this more precisely?",
  "What should I confirm with an immigration attorney about this?"
];

function buildFollowUpQuestions(topics: TopicBucket[]): string[] {
  const seen = new Set<string>();
  const questions: string[] = [];

  for (const topic of topics) {
    for (const question of FOLLOW_UPS_BY_TOPIC[topic] ?? []) {
      if (seen.has(question)) continue;
      seen.add(question);
      questions.push(question);
      if (questions.length >= 3) return questions;
    }
  }

  for (const question of GENERIC_FOLLOW_UPS) {
    if (questions.length >= 3) break;
    if (seen.has(question)) continue;
    seen.add(question);
    questions.push(question);
  }

  return questions;
}

function isExperientialQuestion(query: string): boolean {
  const normalized = query.toLowerCase();
  if (/(how long|processing time|still waiting|how much time|took|delay|stuck|pending|timeline|how fast|when will|when did|how soon|months|weeks|days to)/.test(normalized)) return true;
  if (/(did anyone|has anyone|what happened|rfe|denied|rejected|approved|case status|anyone else|my experience|in my case|success story|real.?world|in practice|actually)/.test(normalized)) return true;
  if (/(people like me|others in|similar case|same situation|community|others have|heard from|typical|average|usually take|normally)/.test(normalized)) return true;
  return false;
}

// Map the user's Haven profile into the coarse, bucketed segment filters the case-stats RPC expects.
function mapVisa(visaType: string): "h1b" | "f1_opt" | "l1" | "other" {
  const v = visaType.toLowerCase().replace(/[\s_]/g, "");
  if (/h-?1b/.test(v)) return "h1b";
  if (/f-?1|opt/.test(v)) return "f1_opt";
  if (/l-?1/.test(v)) return "l1";
  return "other";
}

function bucketNation(country: string): "india" | "china" | "row" | null {
  const c = country.trim().toLowerCase();
  if (!c) return null;
  if (c.includes("india")) return "india";
  if (c.includes("china")) return "china";
  return "row";
}

function mapCategory(preference: string): "eb1" | "eb2" | "eb3" | null {
  const p = preference.toLowerCase().replace(/[\s-]/g, "");
  if (p.includes("eb1")) return "eb1";
  if (p.includes("eb2")) return "eb2";
  if (p.includes("eb3")) return "eb3";
  return null;
}

function buildCaseSegmentFilters(profile: HavenWorkspaceSnapshot["profile"]): CaseSegmentFilters {
  return {
    currentStatus: mapVisa(profile.visaType),
    i140Status: profile.i140Approved ? "approved" : null,
    nationalityBucket: bucketNation(profile.countryOfBirth),
    category: mapCategory(profile.preferenceCategory),
    trigger: "laid_off"
  };
}

// Fire the crowdsourced "what did people like me do?" data path only for layoff / options questions.
function wantsCaseOutcomeStats(query: string, topics: TopicBucket[]): boolean {
  if (!topics.includes("layoffs")) return false;
  const normalized = query.toLowerCase();
  return (
    isExperientialQuestion(query) ||
    /(what (should|can|do|are)|my options|options after|what now|next step|now what)/.test(normalized)
  );
}

function scoreProfileMatch(tags: string[], profile: { visaType: string; preferenceCategory: string; countryOfBirth: string; topConcerns: string[] }): number {
  const normalized = tags.map(t => t.toLowerCase().replace(/[-_\s]/g, ""));
  let score = 0;

  const visaTag = profile.visaType.toLowerCase().replace(/[-_\s]/g, "");
  if (normalized.some(t => t.includes(visaTag) || visaTag.includes(t))) score += 2;

  const catTag = profile.preferenceCategory.toLowerCase().replace(/[-_\s]/g, "");
  if (normalized.some(t => t.includes(catTag) || catTag.includes(t))) score += 2;

  const countryTag = profile.countryOfBirth.toLowerCase().replace(/[-_\s]/g, "");
  if (normalized.some(t => t.includes(countryTag) || countryTag.includes(t))) score += 1;

  for (const concern of profile.topConcerns) {
    const concernTag = concern.toLowerCase().replace(/[-_\s]/g, "");
    if (normalized.some(t => t.includes(concernTag) || concernTag.includes(t))) score += 1;
  }

  return score;
}

function concernToPrompt(concern: Concern, fallbackPrompt: string) {
  switch (concern) {
    case "gc_timeline":
      return "How should I interpret my current green card stage and the next filing milestone?";
    case "job_change":
      return "What should I watch if I change jobs while protecting long-term green card progress?";
    case "visa_expiry":
      return "Which visa dates in my Haven profile matter most in the next six months?";
    case "layoffs":
      return "If layoffs became a risk, what should I organize first based on my Haven data?";
    default:
      return fallbackPrompt;
  }
}

async function getAdvisorIdentity(): Promise<AdvisorIdentity> {
  if (!hasSupabaseEnv) {
    return {
      id: "user-1",
      email: "priya@example.com",
      fullName: "Priya Shah",
      isMock: true
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Haven user"),
    isMock: false
  };
}

export const getAdvisorUsage = cache(async (): Promise<AdvisorUsage> => {
  if (!hasSupabaseEnv) {
    return {
      limit: ADVISOR_CONVERSATION_LIMIT,
      used: 0,
      remaining: ADVISOR_CONVERSATION_LIMIT,
      renewalLabel: "fully available",
      nextRenewalAt: null
    };
  }

  const identity = await getAdvisorIdentity();
  if (identity.isMock) {
    return {
      limit: ADVISOR_CONVERSATION_LIMIT,
      used: 0,
      remaining: ADVISOR_CONVERSATION_LIMIT,
      renewalLabel: "fully available",
      nextRenewalAt: null
    };
  }

  const admin = createSupabaseAdminClient() as any;
  const windowStartMs = Date.now() - ADVISOR_CONVERSATION_WINDOW_HOURS * 60 * 60 * 1000;
  const windowStartIso = new Date(windowStartMs).toISOString();
  const { data: rows, error } = await admin
    .from("advisor_threads")
    .select("created_at")
    .eq("user_id", identity.id)
    .gte("created_at", windowStartIso)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Unable to load advisor usage: ${error.message}`);
  }

  const used = rows?.length ?? 0;
  const remaining = Math.max(ADVISOR_CONVERSATION_LIMIT - used, 0);
  const oldestCreatedAt = rows?.[0]?.created_at ? new Date(rows[0].created_at).getTime() : null;
  const nextRenewalAtMs = oldestCreatedAt != null
    ? oldestCreatedAt + ADVISOR_CONVERSATION_WINDOW_HOURS * 60 * 60 * 1000
    : null;

  return {
    limit: ADVISOR_CONVERSATION_LIMIT,
    used,
    remaining,
    renewalLabel: formatAdvisorRenewal(nextRenewalAtMs != null ? Math.max(nextRenewalAtMs - Date.now(), 0) : null),
    nextRenewalAt: nextRenewalAtMs != null ? new Date(nextRenewalAtMs).toISOString() : null
  };
});

function buildAdvisorContext(snapshot: Awaited<ReturnType<typeof getSnapshot>>): AdvisorUserContext {
  const { profile, dashboard, timelineEvents, emailInbox, cohorts, warRoom } = snapshot;

  return {
    profileSummary: [
      `Visa type: ${profile.visaType}`,
      `Country of birth: ${profile.countryOfBirth}`,
      `Primary goal: ${profile.primaryGoal}`,
      profile.priorityDate ? `Priority date: ${profile.priorityDate}` : "Priority date: not on file",
      `Preference category: ${profile.preferenceCategory}`,
      `I-140 approved: ${profile.i140Approved ? "yes" : "no"}`,
      `I-485 filed: ${profile.i485Filed ? "yes" : "no"}`,
      `PERM stage: ${profile.permStage}`,
      `Employment status: ${profile.employmentStatus}`,
      `Spouse visa status: ${profile.spouseVisaStatus}`,
      profile.currentVisaExpiryDate ? `Current visa expiry date: ${profile.currentVisaExpiryDate}` : "Current visa expiry date: not on file",
      profile.topConcerns.length > 0 ? `Top concerns: ${profile.topConcerns.join(", ")}` : null
    ].filter(Boolean) as string[],
    timelineSummary: timelineEvents.slice(0, 4).map((event) => `${event.title}: ${event.dateLabel}. Next action: ${event.nextAction}`),
    derivedSignalsSummary: [
      dashboard.signals.h1bCapDate ? `Estimated H-1B 6-year cap date: ${dashboard.signals.h1bCapDate}` : "H-1B cap date unavailable",
      dashboard.signals.visaBulletinPosition ? `Visa bulletin status: ${dashboard.signals.visaBulletinPosition}` : "Visa bulletin status unavailable",
      dashboard.signals.estimatedGreenCardDateRange
        ? `Estimated green card date range: ${dashboard.signals.estimatedGreenCardDateRange}`
        : "Estimated green card date range unavailable",
      `Layoff readiness: ${dashboard.signals.layoffReadinessScore}`
    ],
    emailEvidenceSummary: emailInbox
      .slice(0, 3)
      .map((record) => `${record.subject}: ${record.extractedFields.map((field) => `${field.label} ${field.value}`).join("; ")}`),
    communitySummary: [...cohorts.flatMap((cohort) => cohort.posts), ...warRoom.posts]
      .slice(0, 3)
      .map((post) => `${post.title}: ${post.body}`)
  };
}

type AdvisorSeedSnapshot = Pick<HavenWorkspaceSnapshot, "profile">;

/**
 * How well does this person already know the Advisor?
 *
 * Used to taper: a first-time visitor needs orientation, somebody on their tenth
 * conversation needs the box to type in. Repeating the full introduction to
 * somebody who has been here every day for a fortnight is the same failure as
 * repeating the five-option layoff menu on every turn — it reads as a product that
 * has not noticed them.
 */
export type AdvisorFamiliarity = "first-visit" | "returning" | "regular";

export interface AdvisorSessionContext {
  familiarity: AdvisorFamiliarity;
  priorConversations: number;
  lastTitle: string | null;
  lastActiveAt: string | null;
}

function familiarityFor(priorConversations: number): AdvisorFamiliarity {
  if (priorConversations === 0) return "first-visit";
  if (priorConversations < 4) return "returning";
  return "regular";
}

function buildSuggestedPrompts(snapshot: AdvisorSeedSnapshot, session: AdvisorSessionContext) {
  const [firstConcern] = snapshot.profile.topConcerns;
  const prompts = [
    `How does my ${snapshot.profile.preferenceCategory} + ${snapshot.profile.countryOfBirth} path affect what I should watch next?`,
    concernToPrompt(firstConcern ?? "layoffs", "What should I ask Haven first about my immigration timeline?"),
    snapshot.profile.priorityDate
      ? `What does the current visa bulletin mean for my ${snapshot.profile.preferenceCategory} priority date?`
      : "What information do you still need from me to answer green card timeline questions accurately?"
  ];

  // Tapering. Somebody who has had four conversations does not need three worked
  // examples of what a question looks like; they need one nudge or none.
  if (session.familiarity === "regular") return [];
  if (session.familiarity === "returning") return prompts.slice(0, 2);
  return prompts;
}

/**
 * The opening line.
 *
 * This used to be one fixed sentence, forever: "Ask me about work visa and green
 * card questions." For somebody forty days into a grace period, on their eighth
 * visit, that is a product greeting them as a stranger every single time — the
 * exact thing that makes a bot feel like it is not paying attention.
 *
 * It never names what the last conversation was about. Titles are the first 120
 * characters of the user's own question, and those can be intensely personal
 * ("I was fired after telling HR about my diagnosis"). Reflecting one back
 * unprompted, possibly on a shared screen, is a privacy failure dressed as
 * warmth. The list below the greeting shows titles because the user chose to look;
 * the greeting does not put one in front of them.
 */
function createWelcomePayload(
  _snapshot: AdvisorSeedSnapshot,
  session: AdvisorSessionContext
): AdvisorAnswerPayload {
  const answer =
    session.familiarity === "first-visit"
      ? "Ask me about work visa and green card questions. The more specific you are about your dates and current status, the more useful I can be."
      : session.familiarity === "returning"
        ? "Welcome back. Pick up an earlier conversation below, or tell me what's changed since we last talked."
        : "What's changed?";

  return {
    answer_markdown: answer,
    confidence: "medium",
    disclaimer: guardrailText("MSG_DISCLAIMER"),
    external_citations: [],
    haven_context_used: [],
    community_context_used: [],
    follow_up_questions: []
  };
}

function createAssistantMessage(threadId: string, payload: AdvisorAnswerPayload, traceId?: string): AdvisorMessage {
  const createdAt = new Date().toISOString();
  return {
    id: `assistant-${createdAt}`,
    threadId,
    role: "assistant",
    content: payload.answer_markdown,
    createdAt,
    traceId,
    answerPayload: payload
  };
}

async function reserveAdvisorConversation(userId: string, content: string, conversationId?: string) {
  if (!hasSupabaseEnv) {
    return conversationId ?? "session";
  }

  const admin = createSupabaseAdminClient() as any;

  if (conversationId) {
    const { data: existingThread, error } = await admin
      .from("advisor_threads")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Unable to load advisor conversation: ${error.message}`);
    }

    if (existingThread?.id) {
      return existingThread.id as string;
    }
  }

  const windowStart = new Date(Date.now() - ADVISOR_CONVERSATION_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await admin
    .from("advisor_threads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart);

  if (countError) {
    throw new Error(`Unable to enforce advisor conversation limit: ${countError.message}`);
  }

  if ((count ?? 0) >= ADVISOR_CONVERSATION_LIMIT) {
    throw new AdvisorRateLimitError("You can start up to 5 advisor conversations within 24 hours. Please try again later.");
  }

  const title = content.trim().slice(0, 120) || "New conversation";
  const { data: newThread, error: insertError } = await admin
    .from("advisor_threads")
    .insert({
      user_id: userId,
      title
    })
    .select("id")
    .single();

  if (insertError || !newThread?.id) {
    throw new Error(`Unable to create advisor conversation: ${insertError?.message ?? "Missing thread id."}`);
  }

  return newThread.id as string;
}

function buildContextBlock(label: string, lines: string[]) {
  return `${label}:\n${lines.length > 0 ? lines.map((line) => `- ${line}`).join("\n") : "- None"}`;
}

function wantsHavenProfileFacts(query: string) {
  return /(haven profile|my profile|based on.*haven|from my haven|in haven|what should haven|haven help|track|monitor|dashboard|timeline)/i.test(query);
}

/**
 * Which topics genuinely need which date from the profile.
 *
 * The old filter was all-or-nothing: unless the question said "Haven", "my
 * profile", "dashboard" or "timeline", *every* date was stripped. That produced a
 * specific and serious failure. Ask "I was laid off yesterday, what do I do?" and
 * the Advisor was handed the layoff guardrail — which instructs it that the grace
 * period runs "60 days or until I-94/petition validity ends, whichever is shorter"
 * — with the visa expiry date removed from the context. It was told to apply a rule
 * and denied the input the rule needs, so it could only ever restate the rule in
 * the abstract when the user was asking for their own deadline.
 *
 * The original intent was sound: stop the model sprinkling the priority date into
 * questions that have nothing to do with it. But that job is already done properly
 * by `stripUnrequestedPriorityDate`, which works by provenance rather than by
 * guessing from the question's wording. So this filter can be narrowed to what it
 * is actually good at — routing each date to the topics that need it.
 */
const PRIORITY_DATE_TOPICS: TopicBucket[] = ["visa-bulletin", "cspa", "adjustment-of-status"];
const STATUS_DATE_TOPICS: TopicBucket[] = ["layoffs", "h1b", "student-status", "job-change"];

function buildPromptProfileSummary(query: string, topics: TopicBucket[], userContext: AdvisorUserContext) {
  if (wantsHavenProfileFacts(query)) {
    return userContext.profileSummary;
  }

  const allowPriorityDate = topics.some((topic) => PRIORITY_DATE_TOPICS.includes(topic));
  const allowStatusDates = topics.some((topic) => STATUS_DATE_TOPICS.includes(topic));

  return userContext.profileSummary.filter((line) => {
    if (/^priority date:/i.test(line)) return allowPriorityDate;
    if (/^current visa expiry date:/i.test(line)) return allowStatusDates;
    return true;
  });
}

function buildPromptTimelineSummary(query: string, userContext: AdvisorUserContext) {
  return wantsHavenProfileFacts(query) ? userContext.timelineSummary : [];
}

function buildPromptEmailEvidence(query: string, userContext: AdvisorUserContext) {
  return /(email|document|notice|receipt|attorney update|i-797|approval notice|filing notice)/i.test(query)
    ? userContext.emailEvidenceSummary
    : [];
}

function buildPromptDerivedSignals(query: string, topics: TopicBucket[], userContext: AdvisorUserContext) {
  if (wantsHavenProfileFacts(query)) {
    return userContext.derivedSignalsSummary;
  }

  const allowStatusDates = topics.some((topic) => STATUS_DATE_TOPICS.includes(topic));
  const allowProjection = topics.some((topic) => PRIORITY_DATE_TOPICS.includes(topic));

  return userContext.derivedSignalsSummary.filter((line) => {
    // The 6-year cap date is the other half of a layoff timeline question.
    if (/h-1b (6-year )?cap date/i.test(line)) return allowStatusDates;
    // The green card projection is a bulletin/priority-date concept and has no
    // business appearing in an answer about a 60-day grace period.
    if (/estimated green card date range/i.test(line)) return allowProjection;
    return true;
  });
}

async function moderateMessage(content: string, parent?: LangfuseParent) {
  const client = getOpenAIClient();

  if (!client) {
    return { flagged: false };
  }

  try {
    const span = parent?.span({ name: "openai-moderation", input: { content } });

    const moderation = await client.moderations.create({
      model: "omni-moderation-latest",
      input: content
    });

    const result = moderation.results?.[0];
    const flagged = result?.flagged ?? false;
    const categories = result?.categories
      ? Object.entries(result.categories).filter(([, hit]) => hit).map(([name]) => name)
      : [];

    // Categories now route (CD-11.1/11.2, gate G2). The omni-moderation model
    // returns `self-harm`, `self-harm/intent` and `self-harm/instructions`, so the
    // prefix covers all three and any future sibling. Everything else keeps the
    // scope refusal.
    const distress = categories.some((name) => name.startsWith("self-harm"));

    span?.end({ output: { flagged, categories, distress } });

    return { flagged, categories, distress };
  } catch {
    return { flagged: false, categories: [] as string[], distress: false };
  }
}

async function embedQuery(query: string, parent?: LangfuseParent) {
  const client = getOpenAIClient();

  if (!client) {
    return null;
  }

  const model = getEmbeddingModel();
  const span = parent?.span({ name: "openai-embedding", input: { query, model } });

  const response = await client.embeddings.create({ model, input: query });
  const embedding = response.data[0]?.embedding ?? null;

  span?.end({
    output: { dimensions: embedding?.length ?? 0, tokens: response.usage?.total_tokens },
  });

  return embedding;
}

function buildFallbackKnowledgeChunks(): RetrievedKnowledgeChunk[] {
  const sourceBySlug = new Map(trustedKnowledgeSources.map((source) => [source.slug, source]));

  return trustedKnowledgeDocuments.flatMap((document) => {
    const source = sourceBySlug.get(document.sourceSlug);
    if (!source) return [];

    return document.chunks.map((chunk, index) => ({
      chunkKey: `${document.slug}:${index}`,
      chunkIndex: index,
      content: chunk,
      topic: document.topic,
      title: document.title,
      url: document.url,
      agency: source.agency,
      sourceSlug: source.slug
    }));
  });
}

function scoreIntentBoost(query: string, chunk: RetrievedKnowledgeChunk) {
  const normalized = query.toLowerCase();
  const sourceText = `${chunk.title} ${chunk.content} ${chunk.url ?? ""}`.toLowerCase();
  let boost = 0;

  if (mentionsJobLoss(normalized) || /(grace period|60-day|day 60|transfer|lca)/.test(normalized)) {
    if (/(grace period|cessation of employment|60-day|h-1b portability|nonfrivolous h-1b petition|lca)/.test(sourceText)) boost += 8;
  }

  if (/(ac21|same or similar|product manager|software engineer|portability)/.test(normalized)) {
    if (/(ac21|same or similar|i-485.*pending|180 days|supplement j|occupational classification)/.test(sourceText)) boost += 8;
  }

  if (/(visa bulletin|dates for filing|final action|priority date)/.test(normalized)) {
    if (/(filing chart|dates for filing|final action|visa bulletin|uscis.*monthly)/.test(sourceText)) boost += 8;
  }

  if (mentionsTravel(normalized)) {
    if (/(advance parole|travel|i-131|abandon|reentry|visa stamp)/.test(sourceText)) boost += 8;
  }

  if (/(opt|cpt|day 1 cpt|dso|sevis|ead card)/.test(normalized)) {
    if (/(opt|cpt|dso|form i-20|ead|student)/.test(sourceText)) boost += 8;
  }

  if (/(cspa|age out|turns 21|turn 21|sought to acquire)/.test(normalized)) {
    if (/(cspa|child status protection|sought-to-acquire|visa availability|cspa age)/.test(sourceText)) boost += 8;
  }

  if (/(niw|national interest waiver|dhanasar|proposed endeavor|denial|refil|appeal|motion)/.test(normalized)) {
    if (/(niw|national interest waiver|dhanasar|proposed endeavor|motion|appeal)/.test(sourceText)) boost += 8;
  }

  if (/(unauthorized work|worked without authorization|misrepresent|hide|conceal|does not notice)/.test(normalized)) {
    if (/(unauthorized employment|unauthorized work|misleading|work authorization|adjustment-of-status problems)/.test(sourceText)) boost += 8;
  }

  return boost;
}

async function retrieveKnowledge(query: string, topics: TopicBucket[], parent?: LangfuseParent) {
  const span = parent?.span({ name: "official-sources-agent", input: { query, topics } });
  const chunks = buildFallbackKnowledgeChunks();
  const normalized = query.toLowerCase();
  const retrievalTopics =
    (topics.includes("h1b") || topics.includes("layoffs")) && (mentionsJobLoss(normalized) || /(grace period|60-day|day 60|lca|h-1b transfer|petition cannot be filed)/.test(normalized))
      ? topics.filter((topic) => topic === "h1b" || topic === "layoffs")
      : topics.includes("student-status") && /(opt|cpt|day 1 cpt|dso|sevis|ead card)/.test(normalized)
      ? topics.filter((topic) => topic === "student-status" || topic === "work-authorization")
      : topics;

  const filtered = chunks.filter((chunk) => {
    if (retrievalTopics.includes("haven-product")) return true;
    return retrievalTopics.includes(chunk.topic as TopicBucket);
  });

  const ranked = (filtered.length > 0 ? filtered : chunks)
    .map((chunk) => ({
      ...chunk,
      similarity: scoreOverlap(query, `${chunk.title} ${chunk.content} ${chunk.topic}`) + scoreIntentBoost(query, chunk)
    }))
    .sort((left, right) => (right.similarity ?? 0) - (left.similarity ?? 0))
    .slice(0, 6);

  span?.end({
    output: {
      count: ranked.length,
      sources: ranked.map((chunk) => ({ agency: chunk.agency, title: chunk.title, url: chunk.url, similarity: chunk.similarity }))
    }
  });

  return ranked;
}

// Completeness checkpoint: the vector path is only worth an embedding call if
// the summaries table actually has rows. It sat empty in production for weeks
// while every question paid for an embedding and silently fell back to the
// static corpus. Cached per process with a TTL so the check costs one tiny
// query every few minutes, not one per question.
let adviceSummariesCheck: { populated: boolean; checkedAt: number } | null = null;
let adviceSummariesEmptyReported = false;
const ADVICE_SUMMARIES_CHECK_TTL_MS = 10 * 60 * 1000;

async function hasCommunityAdviceSummaries(): Promise<boolean> {
  if (adviceSummariesCheck && Date.now() - adviceSummariesCheck.checkedAt < ADVICE_SUMMARIES_CHECK_TTL_MS) {
    return adviceSummariesCheck.populated;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { count, error } = await admin
      .from("community_advice_summaries")
      .select("id", { count: "exact", head: true });
    if (error) {
      return adviceSummariesCheck?.populated ?? true; // unknown — don't block the vector path
    }

    const populated = (count ?? 0) > 0;
    adviceSummariesCheck = { populated, checkedAt: Date.now() };

    if (!populated && !adviceSummariesEmptyReported) {
      adviceSummariesEmptyReported = true;
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureMessage(
        "advisor vector retrieval short-circuited: community_advice_summaries is empty (run the summaries sync)",
        "warning"
      );
    }

    return populated;
  } catch {
    return adviceSummariesCheck?.populated ?? true;
  }
}

async function retrieveCommunity(
  query: string,
  topics: TopicBucket[],
  snapshot: Awaited<ReturnType<typeof getSnapshot>>,
  parent?: LangfuseParent
) {
  if (!isExperientialQuestion(query)) {
    return [] as RetrievedCommunitySummary[];
  }

  const profile = snapshot.profile;
  const span = parent?.span({ name: "community-story-agent", input: { query, topics, experiential: true } });

  // Vector search path
  if (hasSupabaseEnv && (await hasCommunityAdviceSummaries())) {
    const embedding = await embedQuery(query, span);

    if (embedding) {
      try {
        const admin = createSupabaseAdminClient() as any;
        const filterTopics = topics.filter(t => t !== "haven-product");

        const { data, error } = await admin.rpc("match_community_advice_summaries", {
          query_embedding: asPgVector(embedding),
          match_count: 8,
          filter_topics: filterTopics.length > 0 ? filterTopics : null
        });

        if (!error && Array.isArray(data) && data.length > 0) {
          const ranked = (data as Array<{
            id: string; title: string; topic: string; summary: string;
            legal_caveat: string; tags: string[]; similarity: number;
          }>).map(item => {
            const profileScore = scoreProfileMatch(item.tags ?? [], profile);
            return {
              title: item.title,
              topic: item.topic ?? "community",
              summary: item.summary,
              legalCaveat: item.legal_caveat ?? "Community experiences are anecdotal and may not match your facts.",
              tags: item.tags ?? [],
              similarity: (item.similarity ?? 0) + profileScore * 0.05
            };
          }).sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0)).slice(0, 3);

          span?.end({
            output: {
              source: "vector",
              count: ranked.length,
              stories: ranked.map((s) => ({ title: s.title, topic: s.topic, summary: s.summary, similarity: s.similarity }))
            }
          });
          return ranked as RetrievedCommunitySummary[];
        }
      } catch {
        // fall through to text overlap fallback
      }
    }
  }

  // Fallback: text overlap on snapshot + corpus
  const fallback = [...buildSnapshotCommunitySummaries(snapshot), ...buildFallbackCommunitySummaries()]
    .map((item) => ({
      ...item,
      similarity: scoreOverlap(query, `${item.title} ${item.summary} ${item.topic}`) +
        scoreProfileMatch(item.tags ?? [], profile) * 0.05
    }))
    .sort((left, right) => (right.similarity ?? 0) - (left.similarity ?? 0))
    .slice(0, 3);

  span?.end({
    output: {
      source: "fallback",
      count: fallback.length,
      stories: fallback.map((s) => ({ title: s.title, topic: s.topic, summary: s.summary, similarity: s.similarity }))
    }
  });
  return fallback;
}

function buildSnapshotCommunitySummaries(snapshot: Awaited<ReturnType<typeof getSnapshot>>) {
  const cohortSummaries = snapshot.cohorts.flatMap((cohort) =>
    cohort.posts.map((post) => ({
      title: `${cohort.name}: ${post.title}`,
      topic: post.tags[0]?.toLowerCase() ?? "community",
      summary: post.body,
      legalCaveat: "Community experiences are anecdotal and may not match your facts.",
      tags: post.tags
    }))
  );
  const warRoomSummaries = snapshot.warRoom.posts.map((post) => ({
    title: `${snapshot.warRoom.name}: ${post.title}`,
    topic: post.tags[0]?.toLowerCase() ?? "community",
    summary: post.body,
    legalCaveat: "Community experiences are anecdotal and may not match your facts.",
    tags: post.tags
  }));

  return [...cohortSummaries, ...warRoomSummaries];
}

function buildCitationSet(
  knowledge: RetrievedKnowledgeChunk[],
  liveBulletin: LiveBulletinSnapshot | null
): AdvisorCitation[] {
  const deduped = new Map<string, AdvisorCitation>();

  // Live bulletin leads when present: it is the most current thing we hold, and
  // pinning the month into a citation means the user sees which bulletin the
  // answer rests on without depending on the model to mention it.
  if (liveBulletin) {
    deduped.set("live-bulletin", {
      kind: "external",
      label: `Department of State · Visa Bulletin ${liveBulletin.bulletinLabel}`,
      url: liveBulletin.sourceUrl ?? undefined,
      quote: `Bulletin month: ${liveBulletin.bulletinLabel} (${liveBulletin.ageDays} days old).`,
      citationIndex: 0
    });
  }

  knowledge.forEach((chunk) => {
    const key = `${chunk.title}:${chunk.url}`;
    if (deduped.has(key)) return;

    deduped.set(key, {
      kind: "external",
      label: `${chunk.agency} · ${chunk.title}`,
      url: chunk.url,
      quote: chunk.content,
      citationIndex: deduped.size
    });
  });

  return Array.from(deduped.values()).slice(0, 4);
}

/** Effective date of the newest bulletin document in the hardcoded corpus. */
function newestCorpusBulletinDate(): string | null {
  return (
    trustedKnowledgeDocuments
      .filter((document) => document.topic === "visa-bulletin" && document.effectiveDate)
      .map((document) => document.effectiveDate as string)
      .sort()
      .at(-1) ?? null
  );
}

/**
 * Whether bulletin material on hand is too old to support month-specific
 * conclusions.
 *
 * Staleness is measured against the newest bulletin we actually hold. When the
 * weekly sync has live data, that is the live bulletin month; the hardcoded
 * corpus date is only a fallback for when the live table is unavailable. The
 * previous version read the corpus constant unconditionally, so a fresh live
 * bulletin could not clear the gate and a redeploy was the only way to reset it.
 */
function detectStaleBulletin(
  knowledge: RetrievedKnowledgeChunk[],
  topics: TopicBucket[],
  liveBulletin: LiveBulletinSnapshot | null
) {
  if (!topics.includes("visa-bulletin")) {
    return false;
  }

  if (liveBulletin) {
    // Live data present: the bulletin month itself is the freshness signal.
    // No dependency on retrieved chunks — the live table is the source now.
    return liveBulletin.ageDays > 45;
  }

  const newest = newestCorpusBulletinDate();
  if (!newest) {
    return true;
  }

  const ageDays = (Date.now() - new Date(newest).getTime()) / (1000 * 60 * 60 * 24);

  return ageDays > 45 && knowledge.some((chunk) => chunk.topic === "visa-bulletin");
}

const STALE_BULLETIN_MARKER = "Note on bulletin data:";

/**
 * Deterministic disclosure appended to bulletin answers when our data is old.
 *
 * Returns null when the bulletin material is current, when the question is not
 * a bulletin question, or when the answer already carries the marker (so a
 * regenerated or fallback answer is not annotated twice).
 */
export function buildStaleBulletinNotice(
  topics: TopicBucket[],
  knowledge: RetrievedKnowledgeChunk[],
  liveBulletin: LiveBulletinSnapshot | null,
  answer: string
): string | null {
  if (!detectStaleBulletin(knowledge, topics, liveBulletin)) {
    return null;
  }
  if (answer.includes(STALE_BULLETIN_MARKER)) {
    return null;
  }

  const held = liveBulletin
    ? `the most recent Visa Bulletin Haven holds is **${liveBulletin.bulletinLabel}**, which is ${liveBulletin.ageDays} days old`
    : "Haven currently has no live Visa Bulletin data";

  return (
    `${STALE_BULLETIN_MARKER} ${held}. A newer bulletin has almost certainly been published since. ` +
    "Treat any month-specific cutoff or filing conclusion above as unverified, and confirm against the " +
    "[official Visa Bulletin](https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html) " +
    "and the USCIS filing-chart page before you act on it."
  );
}

function fallbackAnswer(
  question: string,
  userContext: AdvisorUserContext,
  knowledge: RetrievedKnowledgeChunk[],
  community: RetrievedCommunitySummary[],
  topics: TopicBucket[],
  liveBulletin: LiveBulletinSnapshot | null
): AdvisorAnswerPayload {
  const citations = buildCitationSet(knowledge, liveBulletin);

  if (detectStaleBulletin(knowledge, topics, liveBulletin)) {
    // Name what we hold and how old it is. "May be stale" with no date is the
    // vagueness this refusal exists to prevent.
    const heldLine = liveBulletin
      ? `The most recent bulletin Haven holds is ${liveBulletin.bulletinLabel}, which is ${liveBulletin.ageDays} days old.`
      : "Haven currently has no live visa bulletin data.";

    return {
      answer_markdown:
        `I can explain how the visa bulletin works, but I should not give a month-specific filing conclusion right now.\n\n${heldLine} Check the official Visa Bulletin and the USCIS monthly filing-chart page before acting on any timing-sensitive filing decision.`,
      confidence: "low",
      disclaimer: guardrailText("MSG_DISCLAIMER"),
      external_citations: citations,
      haven_context_used: [],
      community_context_used: [],
      follow_up_questions: [
        "Do you want a plain-language explanation of Final Action Dates vs. Dates for Filing?",
        "Do you want me to focus on how your priority date fits into the monthly chart logic?"
      ],
      refusal_or_escalation_reason: liveBulletin
        ? `Newest bulletin held (${liveBulletin.bulletinLabel}) is ${liveBulletin.ageDays} days old.`
        : "No live visa bulletin data available."
    };
  }

  const havenContextUsed = [
    ...buildPromptProfileSummary(question, topics, userContext).slice(0, 4),
    ...buildPromptDerivedSignals(question, topics, userContext).slice(0, 1)
  ].filter(Boolean);
  const communityUsed = community.slice(0, 2).map((item) => `${item.title}: ${item.summary}`);
  const sourceBullets = knowledge
    .slice(0, 3)
    .map((item) => `- ${item.content} (${item.agency})`)
    .join("\n");
  const havenBullets = havenContextUsed.map((item) => `- ${item}`).join("\n");
  const communityBullets = communityUsed.length > 0 ? communityUsed.map((item) => `- ${item}`).join("\n") : "- None used.";

  const answerLines = [
    "Here is the safest read based on official sources and your Haven data.",
    "",
    "Official guidance",
    sourceBullets || "- I found limited direct source support, so treat this as general guidance.",
    "",
    "Your Haven context",
    havenBullets || "- No personalized Haven fields materially changed this answer.",
    ""
  ];

  if (communityUsed.length > 0) {
    answerLines.push("Community context (anecdotal only)");
    answerLines.push(communityBullets);
    answerLines.push("");
  }

  if (topics.includes("job-change") || topics.includes("layoffs")) {
    answerLines.push(
      "If this is about a live job loss or portability decision, use Haven to stay organized and confirm any filing strategy with counsel before acting."
    );
  } else if (topics.includes("visa-bulletin")) {
    answerLines.push(
      "For filing-timing questions, the most important next step is checking the current month's USCIS filing-chart announcement and comparing it against your priority date."
    );
  } else {
    answerLines.push(
      `I can go narrower if you want me to focus on a specific form, milestone, or decision point in this question: "${question.trim()}"`
    );
  }

  return {
    answer_markdown: answerLines.join("\n"),
    confidence: citations.length >= 2 ? "medium" : "low",
    disclaimer: guardrailText("MSG_DISCLAIMER"),
    external_citations: citations,
    haven_context_used: havenContextUsed,
    community_context_used: communityUsed,
    follow_up_questions: [
      "Do you want the official-source answer only, without community context?",
      "Do you want me to map this answer to the dates already in your Haven timeline?",
      "Do you want a short checklist of what to confirm with your attorney or employer?"
    ]
  };
}

/**
 * Check the generated answer for mandatory content and append what is missing.
 *
 * The copy now comes from the guardrail registry (CD-13.1) so the sentences a user
 * actually reads can be reviewed in one place. `delivered` carries the ids this
 * thread has already seen; `once-per-thread` fixes are skipped when they are in it
 * (CD-13.4), while every hard safety line still fires on every turn.
 *
 * Returns both the text and the ids used, so the trace records which fired.
 */
function buildMandatorySafetyAddendum(
  question: string,
  topics: TopicBucket[],
  answer: string,
  delivered: ReadonlySet<string> = new Set()
): { text: string | null; fired: string[]; suppressed: string[] } {
  const normalizedQuestion = question.toLowerCase();
  const notes: string[] = [];
  const firedIds: string[] = [];
  const suppressedIds: string[] = [];

  // Resolve a set of candidate ids to their text, honouring once-per-thread.
  const take = (ids: Array<string | null>) => {
    const requested = ids.filter((id): id is string => Boolean(id));
    const { fired, suppressed, texts } = resolveGuardrails(requested, delivered);
    firedIds.push(...fired);
    suppressedIds.push(...suppressed);
    return texts;
  };

  if ((topics.includes("h1b") || topics.includes("layoffs")) && (mentionsJobLoss(normalizedQuestion) || /(grace period|day 60|lca|petition cannot be filed)/.test(normalizedQuestion))) {
    const missingUnauthorizedWork = !/do not work without authorization|don't work without authorization|unauthorized work/i.test(answer);
    const missingLcaWarning = !/lca preparation alone does not preserve status|lca.*not.*preserve status|lca.*not.*filed h-1b petition/i.test(answer);
    const missingImmediateCounsel = !/confirm.*deadline.*counsel|confirm.*filing strategy.*counsel|immigration counsel immediately/i.test(answer);
    const missingFallbackOptions = !/(departure|depart|leave the u\.s\.|consular|change of status|b-2|premium processing|receipt notice|form i-129)/i.test(answer);
    // Previously this checked for one eval fixture's dates and, when absent, asserted
    // them. It fired only for that fixture, so real users got no correction at all
    // while the eval suite reported the check as working. The general form: if the
    // answer treats the I-94 date as the grace-period endpoint, say the rule instead
    // of naming any date.
    const treatsI94AsGraceEnd = /grace period[^.]*(until|through|to)[^.]*i-94|i-94[^.]*grace period (?:ends|lasts|runs)/i.test(answer);
    const statesWhicheverIsShorter = /whichever (?:is|comes) (?:shorter|first|earlier)/i.test(answer);
    const missingGraceCap = treatsI94AsGraceEnd && !statesWhicheverIsShorter;
    const missingPortabilityTrigger = !/properly filed nonfrivolous|nonfrivolous.*petition.*filed|filed.*nonfrivolous/i.test(answer);

    if (missingUnauthorizedWork || missingLcaWarning || missingImmediateCounsel || missingFallbackOptions || missingGraceCap || missingPortabilityTrigger) {
      const texts = take([
        missingGraceCap ? "FIX_GRACE_PERIOD_CAP" : null,
        missingUnauthorizedWork ? "FIX_NO_UNAUTHORIZED_WORK" : null,
        missingLcaWarning ? "FIX_LCA_NOT_PROTECTION" : null,
        missingFallbackOptions ? "FIX_FALLBACK_OPTIONS" : null,
        missingPortabilityTrigger ? "FIX_PORTABILITY_TRIGGER" : null,
        missingImmediateCounsel ? "FIX_IMMEDIATE_COUNSEL" : null
      ]);

      if (texts.length > 0) {
        notes.push(["H-1B safety note:", ...texts].join(" "));
      }
    }
  }

  if (topics.includes("student-status") && /(day 1 cpt|cpt)/.test(normalizedQuestion)) {
    const missingOptRisk = !/12 months.*full-time cpt|full-time cpt.*12 months|ineligible for post-completion opt/i.test(answer);
    const missingI20 = !/form i-20|i-20/i.test(answer);

    if (missingOptRisk || missingI20) {
      const texts = take([missingI20 ? "FIX_CPT_I20" : null, missingOptRisk ? "FIX_CPT_OPT_RISK" : null]);
      if (texts.length > 0) {
        notes.push(["CPT safety note:", ...texts].join(" "));
      }
    }
  }

  if (topics.includes("adjustment-of-status") && mentionsTravel(normalizedQuestion)) {
    const missingPendingApWarning = !/pending advance parole.*not enough|pending i-131.*not enough|do not travel based only on pending ap|pending advance parole.*not.*permission/i.test(answer);
    const missingAbandonmentWarning = !/abandon.*i-485|i-485.*abandon/i.test(answer);
    const missingPlainEnglishDistinction = !/(visa stamp|visa).*?(status).*?(advance parole)|(advance parole).*?(status).*?(visa stamp)/is.test(answer);
    const missingReentryOptions = !/(wait.*approved ap|wait.*advance parole|h-1b.*stamp|consular|automatic visa revalidation|attorney-review options)/is.test(answer);

    if (missingPendingApWarning || missingAbandonmentWarning || missingPlainEnglishDistinction || missingReentryOptions) {
      const texts = take([
        missingPlainEnglishDistinction ? "FIX_AP_DISTINCTION" : null,
        missingPendingApWarning ? "FIX_PENDING_AP" : null,
        missingAbandonmentWarning ? "FIX_I485_ABANDONMENT" : null,
        missingReentryOptions ? "FIX_REENTRY_OPTIONS" : null,
        "FIX_REENTRY_COUNSEL"
      ]);

      if (texts.length > 0) {
        notes.push(["I-485 travel safety note:", ...texts].join(" "));
      }
    }
  }

  if (topics.includes("self-petition") && /(denied|denial|refil|re-file|appeal|motion|proposed endeavor)/.test(normalizedQuestion)) {
    const missingNoAssumption = !/do not assume refiling is best|don't assume refiling is best|do not assume.*refil|don't assume.*refil/i.test(answer);
    const missingDeadlines = !/deadline|time limit|i-290b|motion|appeal/i.test(answer);

    if (missingNoAssumption || missingDeadlines) {
      const texts = take([
        missingNoAssumption ? "FIX_NIW_NO_ASSUMPTION" : null,
        missingDeadlines ? "FIX_NIW_DEADLINES" : null
      ]);
      if (texts.length > 0) {
        notes.push(["NIW strategy note:", ...texts].join(" "));
      }
    }
  }

  if (topics.includes("cspa")) {
    const missingNoCalculation = !/do not calculate.*cspa|do not.*cspa age.*incomplete|should not calculate.*cspa|without full facts/i.test(answer);
    const missingImmediateReview = !/attorney.*immediately|immediate attorney|consult.*attorney.*immediately|review.*immediately/i.test(answer);

    if (missingNoCalculation || missingImmediateReview) {
      const texts = take([
        missingNoCalculation ? "FIX_CSPA_NO_CALCULATION" : null,
        missingImmediateReview ? "FIX_CSPA_IMMEDIATE_REVIEW" : null
      ]);
      if (texts.length > 0) {
        notes.push(["CSPA safety note:", ...texts].join(" "));
      }
    }
  }

  return {
    text: notes.length > 0 ? notes.join("\n\n") : null,
    fired: firedIds,
    suppressed: suppressedIds
  };
}

// Date-free. The grace-period endpoint depends on facts only the user has, so a
// correction states the rule and hands the arithmetic back rather than guessing.
const GRACE_PERIOD_CORRECTION = guardrailText("FIX_GRACE_PERIOD_DATE_FREE");

// Escape a date so it can be matched literally inside a constructed RegExp.
function escapeForRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Strip a priority date the user never mentioned.
 *
 * The model sometimes echoes the profile's priority date into answers to
 * hypothetical questions. This used to be handled by scrubbing the literal string
 * "June 12, 2025" — the demo profile's date. But that is an entirely ordinary real
 * EB-2 date, so any real user who happened to share it would have their own date
 * deleted from their own answer.
 *
 * Scrubbing by provenance instead fixes both halves: it works for every user's
 * profile date rather than one hardcoded value, and it never touches a date the
 * user supplied themselves.
 */
function stripUnrequestedPriorityDate(question: string, answer: string, profilePriorityDate: string | null) {
  if (!profilePriorityDate) return answer;
  if (question.toLowerCase().includes(profilePriorityDate.toLowerCase())) return answer;

  const stated = question.match(/(?:priority date is|priority date:)\s*([A-Z][a-z]+ \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2})/i)?.[1] ?? null;
  const date = escapeForRegExp(profilePriorityDate);

  return answer
    .replace(new RegExp(`Since your priority date is ${date},?\\s*`, "gi"), stated ? `Since your priority date is ${stated}, ` : "")
    .replace(new RegExp(`your priority date \\(${date}\\)`, "gi"), stated ? `your priority date (${stated})` : "your priority date")
    .replace(new RegExp(`priority date of ${date}`, "gi"), stated ? `priority date of ${stated}` : "priority date")
    .replace(new RegExp(`for your priority date ${date}`, "gi"), "for your priority date")
    .replace(new RegExp(`\\s*\\(${date}\\)`, "gi"), "");
}

function normalizeHighRiskAnswer(
  question: string,
  topics: TopicBucket[],
  answer: string,
  profilePriorityDate: string | null = null
) {
  const normalizedQuestion = question.toLowerCase();

  if (topics.includes("adjustment-of-status") && mentionsTravel(normalizedQuestion)) {
    return answer
      .replace(
        /\bYou cannot travel internationally next month(?:[^.]*pending I-485[^.]*)?\./i,
        guardrailText("FIX_AP_TRAVEL_HEDGE")
      )
      .replace(
        /\bYou cannot travel internationally with a pending I-485 and only a pending advance parole application\./i,
        guardrailText("FIX_AP_TRAVEL_HEDGE_SHORT")
      );
  }

  if ((topics.includes("h1b") || topics.includes("layoffs")) && (mentionsJobLoss(normalizedQuestion) || /(grace period|day 60|lca|petition cannot be filed)/.test(normalizedQuestion))) {
    return answer
      // These corrections must never assert a date. An earlier version substituted
      // dates taken from an eval fixture, so a user whose grace period actually ended
      // in March was told "about August 11, 2026" — a fabricated deadline, five months
      // late, printed beside their own correct date. A correction that introduces a
      // fact the user never supplied is more dangerous than the sentence it replaces.
      .replace(
        /(?:the )?grace period (?:will|would) last until (?:your |the )?I-94[^.]*\./gi,
        GRACE_PERIOD_CORRECTION
      )
      .replace(
        /(?:you have|there (?:are|is)|with)\s+(?:about\s+)?\d+\s+days?\s+(?:left|remaining)[^.]*grace period[^.]*\./gi,
        GRACE_PERIOD_CORRECTION
      )
      .replace(
        /(?:about\s+)?\d+\s+days?\s+(?:left|remaining)\s+(?:until|before)\s+(?:the end of\s+)?(?:your|the)?\s*grace period[^.]*\./gi,
        GRACE_PERIOD_CORRECTION
      )
      .replace(
        /(?:you|the user) (?:cannot|can't|should not|must not) (?:start )?work(?:ing)? until (?:you|they|the employer)? ?(?:receive|get|obtain|have) (?:the )?(?:USCIS )?receipt notice[^.]*\./gi,
        guardrailText("FIX_PORTABILITY_RECEIPT_NOTICE")
      )
      .replace(
        /(?:^|\n)-?\s*\*\*?Temporary unpaid position\*\*?:?[^.\n]*(?:\.[^\n]*)?/gi,
        guardrailText("FIX_NO_UNPAID_WORKAROUND")
      )
      .replace(
        /(?:^|\n)-?\s*Temporary unpaid position:?[^.\n]*(?:\.[^\n]*)?/gi,
        guardrailText("FIX_NO_UNPAID_WORKAROUND")
      );
  }

  if (topics.includes("visa-bulletin") && !topics.includes("cspa")) {
    return stripUnrequestedPriorityDate(question, answer, profilePriorityDate);
  }

  if (topics.includes("cspa")) {
    let normalizedAnswer = stripUnrequestedPriorityDate(question, answer, profilePriorityDate);

    return normalizedAnswer
      .replace(/,?\s*considering the 180-day requirement post-petition and priority date relevance/gi, "")
      .replace(/the 180-day requirement post-petition and /gi, "")
      .replace(/180-day requirement post-petition/gi, "petition pending time");
  }

  return answer;
}

export async function getAdvisorWorkspaceSeed(snapshotArg?: AdvisorSeedSnapshot) {
  const snapshot = snapshotArg ?? await getSnapshot();

  let session: AdvisorSessionContext = {
    familiarity: "first-visit",
    priorConversations: 0,
    lastTitle: null,
    lastActiveAt: null
  };

  // Fetched once and handed to the client as its initial list. The greeting needs
  // the conversation count anyway, and having the client fetch the same rows again
  // on mount would double the egress on the one page guaranteed to load them —
  // against the tightest budget in this project.
  let threads: AdvisorThreadSummary[] = [];

  try {
    const identity = await getAdvisorIdentity();
    if (!identity.isMock) {
      threads = await listThreads(identity.id);
      session = {
        familiarity: familiarityFor(threads.length),
        priorConversations: threads.length,
        lastTitle: threads[0]?.title ?? null,
        lastActiveAt: threads[0]?.updatedAt ?? null
      };
    }
  } catch {
    // An unreadable history just means the first-visit greeting, which is correct
    // for a new user and harmless for anyone else. Never fail the page over it.
  }

  return {
    suggestedPrompts: buildSuggestedPrompts(snapshot, session),
    welcomeMessage: createWelcomePayload(snapshot, session),
    session,
    threads
  };
}

export function isAdvisorRateLimitError(error: unknown) {
  return error instanceof AdvisorRateLimitError;
}

export type AdvisorStreamEvent =
  | { type: "start"; conversationId: string | null }
  | { type: "delta"; text: string }
  | { type: "done"; assistantMessage: AdvisorMessage; conversationId: string | null; traceId: string }
  | { type: "error"; message: string; isRateLimit: boolean };

const ADVISOR_PROMPT_NAME = "haven-advisor-system";

export const STREAMING_SYSTEM_PROMPT = [
  "You are Haven Advisor, an immigration information assistant for employment-based visas and green cards.",
  "Answer in clear, well-structured markdown. Use the official source chunks and Haven profile context provided.",
  "Prioritize official sources. Never invent eligibility rules, filing windows, dates, or conclusions.",
  "If the question is too case-specific or risky, provide general guidance and recommend attorney review.",
  "Only answer work visa, green card, or Haven product questions. Politely refuse unrelated topics.",
  "Use the user's Haven profile to personalize your answer only where relevant to their question.",
  "For example: reference their priority date only if the question is about visa bulletin or GC timeline; reference their PERM stage only if the question involves PERM or job change. Do not inject profile facts unrelated to what they asked.",
  "For timeline or processing-time questions, lead with official data (USCIS/DOL processing times, visa bulletin). Use community stories only as supplementary real-world anecdote after the official answer, clearly framed as individual experiences — never as the authoritative answer.",
  "When a 'Community outcome data' block is provided, it contains statistics pre-computed from Haven users in a similar situation. State those figures VERBATIM; never compute, estimate, round, or extrapolate your own percentages or counts. If the block says NO_STATS, tell the user there isn't enough data for their exact profile yet and give general orientation only. Always frame these as what others did (not a recommendation) and end by suggesting they confirm their options with an immigration attorney.",
  "For AC21 or job portability questions, do not imply AC21 helps unless the answer accounts for the pending I-485 requirement, the 180-day pending period, and same-or-similar occupational analysis. If the user has no filed or pending I-485, say AC21 adjustment portability generally is not available from an approved I-140 alone, but still explain the 180-day and same-or-similar requirements so the user understands what is missing.",
  "For I-485 filing questions involving Final Action Dates or Dates for Filing, the controlling filing instruction is USCIS's monthly adjustment filing-chart page. Do not answer yes or no from the Department of State Visa Bulletin alone. User-stated dates override Haven profile dates; never insert a Haven profile priority date unless the user explicitly asks to use their Haven profile. Prefer conditional wording: the user may be able to file only if USCIS authorizes Dates for Filing for that month and the priority date is earlier than the relevant cutoff, assuming all other eligibility requirements are met.",
  "For pending I-485 travel questions, distinguish pending advance parole from approved advance parole. A pending I-131/AP request is not itself permission to travel. Define the concepts plainly: visa stamp means the entry document used to request admission, status means the lawful classification while inside the U.S., and advance parole is a separate travel/reentry document for a pending adjustment case. Avoid absolute wording like 'you cannot travel'; instead say not to travel based only on pending AP and explain that travel depends on approved AP or another valid reentry strategy confirmed with counsel. State the I-485 abandonment risk when someone leaves without approved advance parole or another valid reentry basis. If H-1B status is valid but the visa stamp is expired, explain that H-1B reentry generally requires a valid visa stamp unless the person uses approved advance parole or qualifies for a narrow exception such as automatic visa revalidation. Suggest attorney-review options: wait for AP approval, evaluate H-1B consular stamping, and evaluate automatic visa revalidation only if the itinerary and facts qualify.",
  "For H-1B layoff or transfer questions, keep stay/status questions separate from work authorization questions. Do not treat last paycheck, employer withdrawal, LCA preparation, petition preparation, unpaid work, volunteer work, or a temporary unpaid role as interchangeable with cessation of employment or a filed H-1B petition. Mention the grace period is up to 60 days or until I-94/petition validity ends, whichever is shorter. If the I-94 date is later than the 60-day date, do not say the grace period lasts until the I-94 date; calculate or state the earlier 60-day deadline as the practical deadline. For H-1B portability, the key event is a properly filed nonfrivolous H-1B petition while the worker remains in an authorized period; a receipt notice is evidence of filing, not the legal substitute for filing. In urgent cases near day 60, include the exact safety points 'Do not work without authorization' and 'LCA preparation alone does not preserve status,' then list concrete options such as immediate filing/receipt strategy, possible change of status, departure planning, premium processing or employer escalation, and immediate counsel review.",
  "For F-1 OPT/CPT questions, cite student-employment sources when available. Pending OPT is not permission to work; OPT work generally requires the valid EAD and start date. CPT must be authorized by the DSO and documented on Form I-20 before work begins. For Day 1 CPT, mention 12 months or more of full-time CPT can affect post-completion OPT eligibility, and list concrete verification steps and red flags.",
  "For CSPA age-out questions, do not calculate CSPA age from incomplete facts. Do not insert a specific priority date, I-140 date, or 180-day rule unless the user provided that fact. Flag immediate attorney review and focus on visa availability, petition pending time, the CSPA age formula, sought-to-acquire, adjustment vs consular processing, filing timing, and documents to gather.",
  "For NIW denial/refiling questions, refer to the Dhanasar framework and deadlines. Do not assume refiling is the correct strategy; mention denial-notice review, motion/appeal/refile options, and concrete evidence to make the proposed endeavor specific.",
  "For unauthorized-work or misrepresentation questions, refuse help hiding facts or drafting misleading statements. Give safe next steps: stop unauthorized work, preserve records, and contact immigration counsel immediately about truthful disclosure and possible consequences.",
  "Be concise. Answer the question directly in as few words as it takes to be accurate and complete — no preamble, no restating the question, no filler.",
  "Default to a short answer (2–4 sentences or a tight bulleted list). Only go longer when the question genuinely requires multiple steps, dates, or conditions.",
  "Lead with the direct answer, then add only the context, caveats, or numbers that materially change what the user should do.",
].join(" ");

export async function* streamAdvisorResponse(rawInput: {
  content: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  conversationId?: string;
}): AsyncGenerator<AdvisorStreamEvent> {
  const identity = await getAdvisorIdentity();
  const parsed = advisorRespondSchema.safeParse(rawInput);

  if (!parsed.success) {
    yield { type: "error", message: "Message content is required.", isRateLimit: false };
    return;
  }

  const { content, history: rawHistory, conversationId } = parsed.data;

  // Loaded before routing because the profile contributes to it: a pending I-485
  // turns a bare travel question into an adjustment-of-status travel question.
  const snapshot = await getSnapshot();

  const route = routeAdvisorQuestion({
    content,
    history: rawHistory,
    i485Filed: snapshot.profile.i485Filed
  });
  const topics = route.topics;
  const threadState = buildThreadState({
    currentMatched: route.currentMatched,
    previousMatched: route.previousMatched,
    history: rawHistory,
    matches: matchesAnyTopic
  });
  const experiential = isExperientialQuestion(content);
  const model = getChatModel();

  const lf = getLangfuseClient();
  // One trace per message; group a multi-turn conversation via sessionId so
  // each question gets its own clean observation tree instead of piling up.
  const traceId = crypto.randomUUID();
  const trace = lf?.trace({
    id: traceId,
    name: "advisor-session",
    sessionId: conversationId,
    input: { question: content },
    userId: identity.isMock ? undefined : identity.id,
    metadata: {
      topics,
      experiential,
      model,
      promptName: ADVISOR_PROMPT_NAME,
      // CD-13.2: a guessed classification must be visible in the trace. Without
      // this, an answer built on DEFAULT_TOPICS looked exactly like one built on a
      // real match, and nobody could count how often it happened.
      classification: threadState.resolution,
      consecutiveMisses: threadState.consecutiveMisses
    }
  });

  const moderation = await moderateMessage(content, trace);

  if (moderation.flagged) {
    // Only ever hand back a real thread id. This previously fell back to the
    // literal "session", the client stored it, and the next request failed
    // advisorRespondSchema's .uuid() check — surfacing as "Message content is
    // required." So a single flagged message left the Advisor permanently broken
    // for that session, with an error that named the wrong field. It landed
    // hardest on distressed users: told to rephrase, then told their message was
    // empty, every time after.
    // Deliberately not persisted. This path returns before a thread is reserved, so
    // there is usually nothing to attach to — but the more important reason is that
    // writing a distress disclosure into a conversation history the user will see
    // listed in their sidebar for months is not a kindness. The moderation category
    // is on the trace for measurement; the message itself is not kept here.
    const threadId = conversationId ?? null;
    const guardrailId = moderation.distress ? "MSG_CRISIS_SUPPORT" : "MSG_MODERATION_REFUSAL";
    const flaggedPayload: AdvisorAnswerPayload = {
      answer_markdown: guardrailText(guardrailId),
      confidence: "low",
      // The legal disclaimer is noise under a crisis handoff — it answers a question
      // nobody in that moment is asking, and it makes the response read as
      // boilerplate at the one point where it must not.
      disclaimer: moderation.distress
        ? "These are independent crisis services. Haven is not a crisis or medical service."
        : guardrailText("MSG_DISCLAIMER"),
      external_citations: [],
      haven_context_used: [],
      community_context_used: [],
      follow_up_questions: [],
      refusal_or_escalation_reason: moderation.distress
        ? "Distress signal detected; routed to external crisis support."
        : "Message flagged by moderation.",
    };
    trace?.update({
      metadata: {
        topics,
        experiential,
        model,
        promptName: ADVISOR_PROMPT_NAME,
        retrievalKnowledgeCount: 0,
        retrievalCommunityCount: 0,
        caseStatsTier: "none",
        citationCount: 0,
        fallback: false,
        fallbackReason: null,
        // Surfaced on the trace so the category mix stays filterable in Langfuse,
        // and so the share of flagged traffic that is distress rather than abuse is
        // measurable now that the two are handled differently.
        moderationCategories: moderation.categories,
        moderationDistress: moderation.distress,
        guardrailsFired: [guardrailId]
      },
      output: {
        answer: flaggedPayload.answer_markdown,
        cited: false,
        citationCount: 0,
        refusalOrEscalationReason: flaggedPayload.refusal_or_escalation_reason
      }
    });
    await flushLangfuse();
    yield {
      type: "done",
      assistantMessage: createAssistantMessage(threadId ?? "pending", flaggedPayload, traceId),
      conversationId: threadId,
      traceId
    };
    return;
  }

  // Same rule on the mock path: a sentinel that isn't a UUID would fail schema
  // validation on the next request, so emit null and let the client open a fresh
  // thread instead of sending an id the server will reject.
  const threadId = identity.isMock
    ? conversationId ?? null
    : await reserveAdvisorConversation(identity.id, content, conversationId);

  // The thread row is created here, before generation, and it counts against the
  // user's daily allowance from this moment. Announcing the id now rather than at
  // `done` means a stopped, errored, or abandoned answer still leaves the client
  // holding the conversation it already paid for — otherwise the next question
  // opened a second thread and silently burned another of the five.
  yield { type: "start", conversationId: threadId };

  // Display-only id on in-memory message objects; the wire value stays null so
  // the client never stores a non-UUID conversation id.
  const displayThreadId = threadId ?? "pending";

  // CD-13.2 — stop guessing.
  //
  // When nothing in the question classified and nothing in the previous turn did
  // either, the Advisor used to assume h1b + adjustment-of-status and answer with
  // full confidence. It would do that on every turn, indefinitely, and leave no
  // trace that it had happened. Now the first miss asks which of a few things the
  // user means, and a second consecutive miss stops asking and hands off to a real
  // destination rather than guessing a third time.
  //
  // Both paths return before the model call: an answer to a question we have not
  // understood is worse than no answer, and skipping generation also makes the
  // repair fast, which matters most to the people who end up here.
  if (threadState.resolution === "unmatched") {
    const escalate = threadState.consecutiveMisses >= 2;
    const guardrailId = escalate ? "MSG_ESCALATE_AFTER_MISSES" : "MSG_CLARIFY_UNRECOGNIZED";
    const repairPayload: AdvisorAnswerPayload = {
      answer_markdown: guardrailText(guardrailId),
      confidence: "low",
      disclaimer: guardrailText("MSG_DISCLAIMER"),
      external_citations: [],
      haven_context_used: [],
      community_context_used: [],
      follow_up_questions: [],
      refusal_or_escalation_reason: escalate
        ? `Escalated after ${threadState.consecutiveMisses} consecutive unrecognized turns.`
        : "Question did not match a known topic; asked for clarification."
    };

    trace?.update({
      metadata: {
        topics,
        experiential,
        model,
        promptName: ADVISOR_PROMPT_NAME,
        classification: threadState.resolution,
        consecutiveMisses: threadState.consecutiveMisses,
        guardrailsFired: [guardrailId],
        guardrailsSuppressed: [],
        retrievalKnowledgeCount: 0,
        retrievalCommunityCount: 0,
        caseStatsTier: "none",
        citationCount: 0,
        fallback: false,
        fallbackReason: null
      },
      output: {
        answer: repairPayload.answer_markdown,
        cited: false,
        citationCount: 0,
        refusalOrEscalationReason: repairPayload.refusal_or_escalation_reason
      }
    });
    await flushLangfuse();

    // Stored like any other turn. The clarifying exchange is part of the
    // conversation — losing it on reload would make a resumed thread jump from the
    // user's unclear question straight to whatever they said next.
    if (threadId && !identity.isMock) {
      await persistExchange({
        threadId,
        userId: identity.id,
        question: content,
        answer: repairPayload,
        traceId
      });
    }

    yield { type: "delta", text: repairPayload.answer_markdown };
    yield {
      type: "done",
      assistantMessage: createAssistantMessage(displayThreadId, repairPayload, traceId),
      conversationId: threadId,
      traceId
    };
    return;
  }

  // The prior turns, rendered for the prompt without timestamps.
  //
  // These used to be stamped `Date.now() - (n - i) * 1000` and printed as "Aug 10,
  // 3:42 PM" — a fabricated time, one second apart, with no year. A thread picked
  // up the next morning claimed every earlier turn had happened seconds ago. A made
  // up timestamp is worse than none in a product doing date arithmetic, and the
  // client sends no real ones, so the honest render is the turn order alone.
  const history = rawHistory.map((m) => ({ role: m.role, content: m.content }));

  const userContext = buildAdvisorContext(snapshot);

  // Retrieval agents run under a shared parent span so the official-source and
  // community-story handoffs are visible as a nested tree under the trace.
  const retrievalSpan = trace?.span({ name: "retrieval", input: { topics } });
  const knowledge = await retrieveKnowledge(content, topics, retrievalSpan);
  const community = await retrieveCommunity(content, topics, snapshot, retrievalSpan);
  const caseStats = wantsCaseOutcomeStats(content, topics)
    ? await getCaseOutcomeStats(buildCaseSegmentFilters(snapshot.profile), retrievalSpan)
    : null;

  // Live bulletin: only fetched for bulletin questions, so an OPT or layoff
  // answer never carries a bulletin citation it did not use.
  const isBulletinQuestion = topics.includes("visa-bulletin");
  const liveBulletin = isBulletinQuestion ? await getLiveBulletinSnapshot() : null;
  const bulletinPosition =
    isBulletinQuestion && liveBulletin ? await renderBulletinPositionForPrompt(snapshot.profile) : null;

  retrievalSpan?.end({
    output: {
      knowledgeCount: knowledge.length,
      communityCount: community.length,
      caseStatsTier: caseStats?.tier ?? "none",
      liveBulletin: liveBulletin?.bulletinLabel ?? "none",
      liveBulletinAgeDays: liveBulletin?.ageDays ?? null,
      bulletinPositionResolved: Boolean(bulletinPosition)
    }
  });

  // What the user has told us in earlier conversations. Read-only here; nothing is
  // learned until after the answer is delivered, so a question can never be shaped
  // by a fact extracted from that same question.
  let rememberedFacts: RememberedFact[] = [];
  if (!identity.isMock) {
    try {
      rememberedFacts = await listFacts(identity.id);
    } catch {
      // Memory is an enhancement. Losing it must not cost the user an answer.
    }
  }

  const citations = buildCitationSet(knowledge, liveBulletin);
  const communityUsed = community.slice(0, 2).map((item) => `${item.title}: ${item.summary}`);
  const promptProfileSummary = buildPromptProfileSummary(content, topics, userContext);
  const promptTimelineSummary = buildPromptTimelineSummary(content, userContext);
  const promptDerivedSignals = buildPromptDerivedSignals(content, topics, userContext);
  const promptEmailEvidence = buildPromptEmailEvidence(content, userContext);
  const havenContextUsed = promptProfileSummary.slice(0, 4).filter(Boolean);

  const { text: systemPrompt, prompt: advisorPrompt } = await getPrompt(lf, ADVISOR_PROMPT_NAME, STREAMING_SYSTEM_PROMPT);

  // CD-13.1 / CD-13.4: select by id, then resolve to text, dropping orientation the
  // thread has already heard. Hard safety rules are marked `always` in the registry
  // and are never dropped here.
  const guardrails = resolveGuardrails(route.guardrailIds, threadState.delivered);
  const decisionGuardrails = guardrails.texts;

  // CD-13.3: if the Advisor is about to offer the fallback options, give it the
  // attributes behind them — and, just as importantly, the explicit list of things
  // no source supports, so "how much does premium processing cost?" produces a
  // hedge instead of an invented number.
  const optionAttributes = guardrails.fired.includes("GR_LAYOFF_OPTION_MENU")
    ? [renderLayoffOptionsForPrompt()]
    : [];

  // The profile is a snapshot the user last edited at some point, not a live feed.
  // When they open by saying they were just laid off and the profile still reads
  // "Employment status: employed", the model was being handed a flat contradiction
  // with no indication of which side to believe. The user's own account of their
  // situation is always the more current of the two.
  const profileContradictsJobLoss =
    mentionsJobLoss(content.toLowerCase()) && /^employment status:\s*employed/i.test(
      userContext.profileSummary.find((line) => /^employment status:/i.test(line)) ?? ""
    );

  const userPrompt = [
    `Today's date: ${todayForPrompt()} (UTC).`,
    "Use this as the reference point for any deadline, grace period, or filing-window arithmetic. Never guess what today is.",
    "",
    `User question:\n${content}`,
    "",
    buildContextBlock("Decision guardrails", decisionGuardrails),
    "",
    ...(profileContradictsJobLoss
      ? [
          buildContextBlock("Profile freshness", [
            "The user describes a job loss but their saved Haven profile still says they are employed. The profile is stale. Trust what the user says in the question over the profile's employment status, and do not tell them their profile says they are employed."
          ]),
          ""
        ]
      : []),
    ...(optionAttributes.length > 0 ? [buildContextBlock("Option attributes", optionAttributes), ""] : []),
    ...(rememberedFacts.length > 0
      ? [buildContextBlock("What the user told you before (reported, not verified)", renderFactsForPrompt(rememberedFacts)), ""]
      : []),
    buildContextBlock("Haven profile summary", promptProfileSummary),
    "",
    buildContextBlock("Haven timeline summary", promptTimelineSummary),
    "",
    buildContextBlock("Haven derived signals", promptDerivedSignals),
    "",
    buildContextBlock("Haven email evidence", promptEmailEvidence),
    "",
    ...(isBulletinQuestion
      ? [
          "",
          buildContextBlock(
            "Live visa bulletin (authoritative; overrides any bulletin date in the source chunks below)",
            renderBulletinFreshnessForPrompt(liveBulletin, newestCorpusBulletinDate())
          )
        ]
      : []),
    ...(bulletinPosition
      ? ["", buildContextBlock("This user's bulletin position (state verbatim; never compute your own dates)", bulletinPosition)]
      : []),
    "",
    buildContextBlock(
      "Official source chunks",
      knowledge.map((item) => `${item.agency} | ${item.title} | ${item.url} | ${item.content}`)
    ),
    "",
    buildContextBlock(
      "Community summaries",
      community.map((item) => `${item.title} | ${item.summary} | Caveat: ${item.legalCaveat}`)
    ),
    ...(caseStats
      ? ["", buildContextBlock("Community outcome data (state verbatim; never compute your own numbers)", [renderStatsForPrompt(caseStats)])]
      : []),
    "",
    buildContextBlock(
      "Recent conversation",
      history.slice(-6).map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    ),
  ].join("\n");

  const client = getOpenAIClient();
  const generation = trace?.generation({
    name: "openai-advisor-stream",
    model,
    prompt: advisorPrompt,
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  let fullText = "";
  let fallback = false;
  let fallbackReason: string | null = null;

  if (client) {
    try {
      const stream = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          fullText += delta;
          yield { type: "delta", text: delta };
        }
      }

      generation?.end({ output: { answer: fullText, length: fullText.length, citations: citations.length } });
      trace?.update({ output: { answer: fullText, cited: citations.length > 0, citationCount: citations.length } });
    } catch (err) {
      generation?.end({ output: { error: String(err) }, level: "ERROR" });
      const fallbackPayload = fallbackAnswer(content, userContext, knowledge, community, topics, liveBulletin);
      fullText = fallbackPayload.answer_markdown;
      fallback = true;
      fallbackReason = "stream error";
      trace?.update({ output: { answer: fullText, fallback: true, reason: fallbackReason } });
      yield { type: "delta", text: fullText };
    }
  } else {
    const fallbackPayload = fallbackAnswer(content, userContext, knowledge, community, topics, liveBulletin);
    fullText = fallbackPayload.answer_markdown;
    fallback = true;
    fallbackReason = "no openai client";
    trace?.update({ output: { answer: fullText, fallback: true, reason: fallbackReason } });
    yield { type: "delta", text: fullText };
  }

  const normalizedFullText = normalizeHighRiskAnswer(content, topics, fullText, snapshot.profile.priorityDate ?? null);
  if (normalizedFullText !== fullText) {
    fullText = normalizedFullText;
  }

  const addendum = buildMandatorySafetyAddendum(content, topics, fullText, threadState.delivered);
  if (addendum.text) {
    const addendumText = `\n\n${addendum.text}`;
    fullText += addendumText;
    yield { type: "delta", text: addendumText };
  }

  // Stale-bulletin disclosure. detectStaleBulletin used to be consulted only
  // inside fallbackAnswer, which runs when generation fails — so on the normal
  // path, the path every real user takes, a stale bulletin produced no warning
  // at all. Applied here it covers every answer, deterministically, rather than
  // depending on the model to volunteer it.
  const staleNotice = buildStaleBulletinNotice(topics, knowledge, liveBulletin, fullText);
  if (staleNotice) {
    const noticeText = `\n\n${staleNotice}`;
    fullText += noticeText;
    yield { type: "delta", text: noticeText };
  }

  trace?.update({
    output: {
      answer: fullText,
      cited: citations.length > 0,
      citationCount: citations.length,
      fallback,
      fallbackReason,
      staleBulletinNotice: Boolean(staleNotice)
    }
  });

  const answerPayload: AdvisorAnswerPayload = {
    answer_markdown: fullText,
    confidence: citations.length >= 2 ? "high" : citations.length === 1 ? "medium" : "low",
    disclaimer: guardrailText("MSG_DISCLAIMER"),
    external_citations: citations,
    haven_context_used: havenContextUsed,
    community_context_used: communityUsed,
    follow_up_questions: buildFollowUpQuestions(topics),
  };

  trace?.update({
    metadata: {
      topics,
      experiential,
      model,
      promptName: ADVISOR_PROMPT_NAME,
      classification: threadState.resolution,
      consecutiveMisses: threadState.consecutiveMisses,
      // CD-13.1: fixtures and reviews assert on ids, not on English phrases that a
      // prompt edit can silently reword.
      guardrailsFired: [...guardrails.fired, ...addendum.fired],
      guardrailsSuppressed: [...guardrails.suppressed, ...addendum.suppressed],
      retrievalKnowledgeCount: knowledge.length,
      retrievalCommunityCount: community.length,
      caseStatsTier: caseStats?.tier ?? "none",
      citationCount: citations.length,
      fallback,
      fallbackReason
    }
  });

  await flushLangfuse();

  // Persist after the answer is final: the safety addenda and the stale-bulletin
  // notice are appended post-generation, and a stored history missing those would
  // drop exactly the sentences the guardrails exist to add.
  if (threadId && !identity.isMock) {
    await persistExchange({
      threadId,
      userId: identity.id,
      question: content,
      answer: answerPayload,
      traceId
    });

    // Learn only from the user's own words, and only after answering. Nothing the
    // Advisor said is ever remembered as fact about the user's life — letting its
    // output feed back into its own future context is how one small error becomes
    // permanent.
    await rememberFactsFrom({ threadId, userId: identity.id, message: content });
  }

  yield { type: "done", assistantMessage: createAssistantMessage(displayThreadId, answerPayload, traceId), conversationId: threadId, traceId };
}

export async function syncTrustedSources() {
  const client = getOpenAIClient();
  const sourceCount = trustedKnowledgeSources.length;
  const documentCount = trustedKnowledgeDocuments.length;
  const fallbackCommunity = buildFallbackCommunitySummaries();

  if (!hasSupabaseEnv) {
    return {
      sources: sourceCount,
      documents: documentCount,
      chunks: trustedKnowledgeDocuments.reduce((sum, doc) => sum + doc.chunks.length, 0),
      communitySummaries: fallbackCommunity.length
    };
  }

  const admin = createSupabaseAdminClient() as any;
  const runId = crypto.randomUUID();

  await admin.from("source_sync_runs").insert({
    id: runId,
    source_slug: "trusted-corpus",
    status: "running",
    summary: "Seeding Haven advisor trusted-source corpus"
  });

  try {
    const { data: sourceRows, error: sourceError } = await admin
      .from("knowledge_sources")
      .upsert(
        trustedKnowledgeSources.map((source) => ({
          slug: source.slug,
          label: source.label,
          agency: source.agency,
          base_url: source.baseUrl,
          topic: source.topic,
          trust_priority: source.trustPriority,
          is_active: true
        })),
        { onConflict: "slug" }
      )
      .select("*");

    if (sourceError || !sourceRows) {
      throw new Error(sourceError?.message ?? "Unable to sync knowledge sources.");
    }

    const sourceBySlug = new Map(sourceRows.map((row: any) => [row.slug, row]));
    const documentRowsToUpsert = trustedKnowledgeDocuments.map((document) => {
      const sourceRow = sourceBySlug.get(document.sourceSlug) as any;
      const sourceId = sourceRow?.id;
      if (!sourceId) {
        throw new Error(`Missing source mapping for ${document.sourceSlug}`);
      }

      return {
        slug: document.slug,
        source_id: sourceId,
        title: document.title,
        url: document.url,
        topic: document.topic,
        version_label: document.versionLabel,
        effective_date: document.effectiveDate ?? null,
        // These documents are compiled into the bundle, not fetched from the
        // agency. Stamping "now" here claimed a freshness the content does not
        // have and made a stale corpus look current in the database. The
        // document's own effective date is the only honest signal we have.
        fetched_at: document.effectiveDate ? new Date(`${document.effectiveDate}T00:00:00Z`).toISOString() : null,
        content_hash: getSourceHash(document.bodyMarkdown),
        is_current: true,
        body_markdown: document.bodyMarkdown,
        metadata: {
          sourceSlug: document.sourceSlug
        }
      };
    });

    const { data: documentRows, error: documentError } = await admin
      .from("knowledge_documents")
      .upsert(documentRowsToUpsert, { onConflict: "slug" })
      .select("*");

    if (documentError || !documentRows) {
      throw new Error(documentError?.message ?? "Unable to sync knowledge documents.");
    }

    const docBySlug = new Map(documentRows.map((row: any) => [row.slug, row]));
    const embeddingsByChunkKey = new Map<string, string | null>();

    if (client) {
      for (const document of trustedKnowledgeDocuments) {
        const embeddings = await client.embeddings.create({
          model: getEmbeddingModel(),
          input: document.chunks
        });

        document.chunks.forEach((chunk, index) => {
          const embedding = embeddings.data[index]?.embedding;
          embeddingsByChunkKey.set(`${document.slug}:${index}`, embedding ? asPgVector(embedding) : null);
        });
      }
    }

    const chunkRows = trustedKnowledgeDocuments.flatMap((document) => {
      const documentRow = docBySlug.get(document.slug) as any;
      const documentId = documentRow?.id;
      if (!documentId) {
        throw new Error(`Missing document mapping for ${document.slug}`);
      }

      return document.chunks.map((chunk, index) => ({
        document_id: documentId,
        chunk_key: `${document.slug}:${index}`,
        chunk_index: index,
        token_count: estimateTokenCount(chunk),
        content: chunk,
        embedding: embeddingsByChunkKey.get(`${document.slug}:${index}`) ?? null,
        metadata: {
          topic: document.topic,
          sourceSlug: document.sourceSlug,
          versionLabel: document.versionLabel
        }
      }));
    });

    const { error: chunkError } = await admin.from("knowledge_chunks").upsert(chunkRows, { onConflict: "document_id,chunk_key" });
    if (chunkError) {
      throw new Error(chunkError.message);
    }

    const communityEmbeddings = new Map<string, string | null>();
    if (client) {
      const response = await client.embeddings.create({
        model: getEmbeddingModel(),
        input: fallbackCommunity.map((item) => `${item.title}\n${item.summary}`)
      });

      fallbackCommunity.forEach((item, index) => {
        const embedding = response.data[index]?.embedding;
        communityEmbeddings.set(item.title, embedding ? asPgVector(embedding) : null);
      });
    }

    await admin.from("community_advice_summaries").upsert(
      fallbackCommunity.map((item) => ({
        title: item.title,
        topic: item.topic,
        summary: item.summary,
        legal_caveat: item.legalCaveat,
        tags: item.tags,
        moderation_status: "approved",
        embedding: communityEmbeddings.get(item.title) ?? null
      })),
      { onConflict: "title" }
    );

    await admin
      .from("source_sync_runs")
      .update({
        status: "succeeded",
        summary: "Trusted Haven advisor sources synced",
        completed_at: new Date().toISOString(),
        details: {
          sources: sourceCount,
          documents: documentCount,
          communitySummaries: fallbackCommunity.length
        }
      })
      .eq("id", runId);

    return {
      sources: sourceCount,
      documents: documentCount,
      chunks: chunkRows.length,
      communitySummaries: fallbackCommunity.length
    };
  } catch (error) {
    await admin
      .from("source_sync_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_text: error instanceof Error ? error.message : "Unknown sync failure"
      })
      .eq("id", runId);

    throw error;
  }
}
