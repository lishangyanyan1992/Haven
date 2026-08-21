import { cache } from "react";
import OpenAI from "openai";

import { env, hasSupabaseEnv } from "@/lib/env";
import { flushLangfuse, getLangfuseClient, getPrompt } from "@/lib/langfuse";
import type { LangfuseSpanClient, LangfuseTraceClient } from "langfuse";
import { classifyIntent, compareRouters } from "@/lib/advisor/intent-router";
import { decideScope, isRedirectedTopic } from "@/lib/advisor/scope";
import { getSnapshot } from "@/lib/repositories/case-compass";
import { resolveTestPersona } from "@/lib/repositories/test-personas";
import { readGracePeriod, renderGracePeriodForPrompt } from "@/lib/advisor/grace-period";
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
import {
  buildThreadState,
  withoutEchoedCurrentTurn,
  type ThreadState,
  type TurnResolution
} from "@/lib/advisor/thread-state";
import { getThreadMessages, listThreads, persistExchange, type AdvisorThreadSummary } from "@/lib/advisor/threads";
import { collectAttempts, renderAttemptsForPrompt } from "@/lib/advisor/attempted-steps";
import { buildAttorneyHandoff, HANDOFF_DELIVERED } from "@/lib/advisor/attorney-handoff";
import { readAnswerOutcome, recordOutcome, IMMEDIATE_LANDED, type ImmediateOutcome } from "@/lib/advisor/answer-outcome";
import { checkSituation, renderSituationForPrompt } from "@/lib/advisor/situation-check";
import { listFacts, rememberFactsFrom, renderFactsForPrompt, type RememberedFact } from "@/lib/advisor/memory";
import {
  detectProfileUpdates,
  filterAlreadyCurrent,
  renderProfileUpdateNotice,
  type ProfileUpdate
} from "@/lib/advisor/profile-updates";
import { persistProfileDraft } from "@/lib/profile-sync";
import { openLayoffEvent } from "@/lib/layoff-events";
import { renderLayoffOptionsForPrompt } from "@/lib/advisor/layoff-options";
import {
  getLiveBulletinSnapshot,
  renderBulletinFreshnessForPrompt,
  renderBulletinPositionForPrompt,
  type LiveBulletinSnapshot
} from "@/lib/advisor/bulletin-live";

// `topics` is the full set the chunk answers under (primary + additional); the
// singular `topic` stays for display, the stale-bulletin gate, and the DB shape.
type RetrievedKnowledgeChunk = KnowledgeChunk & {
  documentId?: string;
  topics?: string[];
  /**
   * True when the agency has retired the page this chunk came from. Carried all
   * the way to the citation so the label can say so — an agency-archived page
   * presented as current guidance is a claim the product should not make
   * silently, and the model cannot infer it from the text.
   */
  agencyArchived?: boolean;
};
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

/**
 * Tags that separate a real user's trace from a test run.
 *
 * Eval scripts, probe questions and production traffic all call this same
 * pipeline and all land in the same Langfuse project. Without a tag the only
 * distinguishing mark was the absence of a userId on mock runs, which is easy to
 * miss and silently wrong the moment somebody points a script at a real account
 * — which is exactly what a founder testing against their own login does.
 *
 * Two independent signals, because they answer different questions:
 *
 *   mock-identity   the run had no real account behind it. Derived, not
 *                   configured, so it cannot be forgotten.
 *   ADVISOR_TRACE_TAG  set by whoever launched the process. This is the one that
 *                   catches a real-account test run, and the only way to catch
 *                   it: nothing inside the request can tell "the owner probing
 *                   the product" from "the owner using the product".
 *
 * Production sets neither and stays untagged, so filtering to real traffic is
 * "no tags" rather than a list that has to be kept current as test harnesses
 * come and go.
 */
export function buildTraceTags(
  identity: { isMock: boolean },
  // Injectable so a test can assert the untagged-production case in the same
  // process as the tagged ones. Reading env at call time would make "production
  // has no tags" the one claim the suite could not check.
  configuredTag: string | undefined = env.ADVISOR_TRACE_TAG,
  // Which test persona the run was answering as. Without it, the same question
  // asked as three different people is three traces that look identical, and the
  // whole point of having personas is comparing those three answers.
  personaId: string | undefined = resolveTestPersona()?.id
): string[] {
  const tags: string[] = [];
  if (identity.isMock) tags.push("mock-identity");
  if (personaId) tags.push(`persona-${personaId}`);

  const configured = configuredTag?.trim();
  if (configured) {
    for (const tag of configured.split(",").map((part) => part.trim()).filter(Boolean)) {
      if (!tags.includes(tag)) tags.push(tag);
    }
  }

  return tags;
}

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
  "notice period",
  // Added after the first phrasing audit of this gate. Every term below was a
  // silent miss: the question classified as nothing, fell through to
  // DEFAULT_TOPICS, and lost every layoff guardrail. They fall into four groups.
  //
  // 1. The active/progressive voice of a rule we already had. "role was
  //    eliminated" matched; "they are eliminating my role" did not, and the
  //    active voice is how people report a decision that has not landed yet —
  //    which is exactly when the 60-day planning advice is most useful.
  "eliminat(e|es|ed|ing) (my|his|her|their|our|the) (position|role|job|team)",
  // 2. Corporate euphemism. Nobody is told "you are being terminated"; they are
  //    told their position is affected by a restructure, or that HR is
  //    offboarding them. This is the vocabulary of the notification itself.
  "restructur(e|es|ed|ing)",
  "reorg(anization|anisation|anized|anised|anizing)?\\b",
  "offboard(ed|ing)?",
  "(been|being|was|were|got) separated",
  "\\bdismissed\\b",
  "outsourc(e|ed|ing)",
  // 3. Contract-side phrasings. Common among consultancy and staffing-firm
  //    workers, a large share of the H-1B population.
  "employment (agreement|contract) (was |been |is )?(ended|terminated|cancell?ed)",
  "(job|position|role) (was |been |is )?(outsourced|gone|going away)"
];

const JOB_LOSS_PATTERN = new RegExp(`(${JOB_LOSS_TERMS.join("|")})`);

/**
 * Unambiguous evidence that the question is about one of the two live topics.
 *
 * Used by the scope gate to let `student-status` and `self-petition` yield when
 * they were mentioned as background rather than asked about. Deliberately narrow:
 * `h1b` and `adjustment-of-status` are DEFAULT_TOPICS, so keying on any in-scope
 * topic would let everything through, and a loose green-card phrase would let a
 * CSPA question ("what happens to her green card?") escape a redirect that
 * matters.
 *
 * Job loss comes via mentionsJobLoss rather than being duplicated here, so the
 * forty phrasings hardened over five rounds are not silently re-derived.
 */
/**
 * The layoff conversation, after the layoff.
 *
 * Every phrasing the classifier knew for this topic named the loss — "laid off",
 * "grace period", "60 days", "B-2". But by the time somebody has an offer and a
 * petition on file, they have stopped talking about the layoff entirely. They ask
 * about the receipt, the transfer, the clock. Reading sixty answers found the
 * single most important question in the product falling through:
 *
 *   "New employer filed with premium. Can I start on the receipt or wait for
 *    approval?"
 *
 * matched nothing, resolved `unmatched`, and was answered with the menu of topics
 * — for all three test personas. That is the portability question. It is the
 * reason the product narrowed to this topic, it is where the collected corpus
 * holds its most confidently wrong advice, and getting it wrong in either
 * direction costs the person either their status or a month of income.
 *
 * Two more fell the same way: a notice period described as "garden leave", and a
 * deadline described as "my clock".
 *
 * These are matched on the object rather than on a bare noun. `receipt` alone
 * appears in ordinary sentences about documents; `start on the receipt` does not.
 */
/**
 * Wording that arises after a layoff *and* just as often without one.
 *
 * Transfers, receipts and start dates are the mechanics of a post-layoff scramble
 * — and they are equally the mechanics of somebody changing jobs on purpose on a
 * Tuesday. Good enough to route a question to the layoff topic, where the cost of
 * being wrong is some extra retrieval. Not good enough to conclude the person has
 * lost their job, where the cost of being wrong is a six-point layoff briefing
 * stapled to "how long does a transfer take".
 */
const POST_LAYOFF_MECHANICS_AMBIGUOUS = [
  // Starting work on a filing rather than an approval — the portability question.
  /\b(start|starting|begin|beginning|join|joining)\b[^.?!]{0,40}\b(receipt|petition|transfer|filing|approval|i-?797)\b/,
  /\b(receipt|petition|transfer|filing|approval|i-?797)\b[^.?!]{0,40}\b(start|starting|begin|beginning|join|joining) (work|working|the|at|a new)\b/,
  /\breceipt (notice|number)\b/,
  /\bh-?1-?b transfer\b/,
  /\btransfer (was |been |is )?(filed|pending|approved)\b/
];

/**
 * Wording that only arises once a job has actually ended.
 *
 * Nobody on a voluntary move talks about their clock running, gardening leave, or
 * what they were paid through. These are safe to treat as a layoff on their own.
 */
const POST_LAYOFF_MECHANICS_DEFINITE = [
  // The deadline, named as a clock rather than as a number of days.
  /\b(my|the) clock\b/,
  /\bclock (is |already )?(running|started|ticking)\b/,
  // The notice period, which is where the clock's start date is actually disputed.
  /\bgarden(ing)? leave\b/,
  /\bnotice period\b/,
  /\blast day (on paper|of (work|employment))\b/,
  /\bpaid (me )?through\b/
];

const POST_LAYOFF_MECHANICS = [...POST_LAYOFF_MECHANICS_AMBIGUOUS, ...POST_LAYOFF_MECHANICS_DEFINITE];

/** Routing-grade: broad on purpose, because the cost of a false positive is retrieval. */
function mentionsPostLayoffMechanics(normalized: string) {
  return POST_LAYOFF_MECHANICS.some((pattern) => pattern.test(normalized));
}

/** Briefing-grade: only wording that means the job has actually ended. */
function mentionsDefiniteJobLoss(normalized: string) {
  return POST_LAYOFF_MECHANICS_DEFINITE.some((pattern) => pattern.test(normalized));
}

const STRONG_IN_SCOPE =
  /(60[- ]day|day 60|grace period|visa bulletin|priority date|dates for filing|final action|retrogress|\bb-?2\b|\bh-?4\b|240[- ]day)/;

export function hasStrongInScopeSignal(normalized: string) {
  return mentionsJobLoss(normalized) || STRONG_IN_SCOPE.test(normalized);
}

/**
 * Bridge status — the largest cluster in the intent corpus, and it routed nowhere.
 *
 * The card sort of 73 real questions found that B-2 and H-4 bridge mechanics plus
 * the 240-day rule are the biggest single group of things people actually ask, and
 * none of them classified: `B-2` matched no topic, `H-4` matched no topic, and the
 * 240-day rule had zero coverage of any kind. Those questions fell to
 * DEFAULT_TOPICS and were answered as generic adjustment-of-status questions with
 * no layoff guardrails at all.
 *
 * They belong to `layoffs` rather than to a topic of their own because they are
 * the same conversation. Somebody asking "can I switch to H-4 while I look for
 * work?" is asking what happens after their job ended; the bridge is the answer to
 * the layoff question, not a separate subject. Routing them here gets them the
 * grace-period rules, the portability trigger, and the option menu — which already
 * names change of status to B-2 — instead of nothing.
 *
 * The 240-day rule sits slightly apart: it is about continuing to work on a timely
 * filed extension, which is not always a layoff. It is included because the user
 * asking it is asking the same underlying question — am I still allowed to be
 * here, and to work — and because the alternative today is no coverage whatsoever.
 *
 * NOTE FOR REVIEW: this routes the questions to existing counsel-shaped guardrails.
 * It does not add substantive rules about H-4 eligibility, B-2 bridge strategy, or
 * the 240-day period, and it should not until an immigration attorney writes them.
 * Routing a question to a safe general answer is a fix; inventing the rule text
 * would not be.
 */
const BRIDGE_STATUS_PATTERN =
  /\b(b-?2\b|h-?4\b|240[- ]day|bridge (status|visa|option)|change of status|cos\b|i-?539)\b/i;

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

// The remaining safety gates, audited the same way the travel gate was: write out
// how real people say the thing, then execute the pattern against all of them.
// Every one of these was a single narrow phrasing, and every one was silent for
// the majority of natural wordings. Covered by evals/advisor/guardrail-phrasing.check.ts.

/**
 * A child ageing out of a family's case.
 *
 * The old pattern needed "turns 21", "turn 21", "age out", "aging out" or the
 * acronym. It missed "will be 21", "ages out" (the plural verb — one letter),
 * "too old to be included", and every way a parent describes this without knowing
 * the term. CSPA deadlines cannot be recovered once missed, which is why the
 * guardrail says to see an attorney immediately.
 */
/**
 * The green-card queue: preference category, country backlog, "what should I
 * watch next".
 *
 * Nothing in the classifier knew what EB-1, EB-2 or EB-3 were. Haven's own first
 * suggested prompt is built from the user's profile as "How does my {category} +
 * {country} path affect what I should watch next?" — so the chip shown at the top
 * of an empty Advisor matched no topic, resolved `unmatched`, and was answered
 * with a refusal to answer. The product's opening move failed on itself.
 *
 * Scoped deliberately. A bare "EB-2" is not enough, because "my EB-2 NIW was
 * denied" is a self-petition question and pulling visa-bulletin sources into it
 * would displace the NIW ones — retrieval keeps only six chunks, which is the
 * lesson from the substring bug. The category has to sit near a queue concept
 * (path, timeline, backlog, wait, what to watch) before this fires.
 */
const GREEN_CARD_PATH_PATTERN =
  /(?:\beb-?[123]\b|employment[- ]based (?:first|second|third)|\bgreen.?card\b)[^.?!]{0,60}\b(?:path|timeline|process|progress|queue|wait|waiting|watch|backlog|retrogress\w*|current|movement|forecast|next|stage|steps?)\b|\b(?:backlog|retrogress\w*|per.?country (?:limit|cap)|priority date)\b/;

/**
 * The queue question asked in plain language.
 *
 * The pattern above requires a queue *noun* near "green card" — timeline, wait,
 * backlog. "How long until I get my green card?" has none of them, so the single
 * most common phrasing of the second in-scope topic matched nothing and was
 * answered with the clarifying menu.
 *
 * This is the same near-miss as `day 60`: the classifier knew the vocabulary of
 * somebody who already understands the system, and not the words used by somebody
 * asking for the first time.
 */
const PLAIN_QUEUE_PATTERN =
  /(how (long|much longer)|when)[^.?!]{0,40}(green.?card|\bgc\b|permanent residen|my turn|be current|priority date)/;

const CSPA_PATTERN =
  /(cspa|child status protection|ages? out|ageing out|aging out|aged out|turns? 21|turning 21|will be 21|becomes? 21|reaches? 21|over 21|21st birthday|sought to acquire|too old to (be included|qualify|stay on)|age.?out)/;

/**
 * A petition that came back refused.
 *
 * Needed "denied", "denial", "refile", "appeal", "motion" or "proposed endeavor".
 * "USCIS said no", "rejected", "turned down" and "came back negative" all lost the
 * guardrail — and motion and appeal windows are short and unrecoverable.
 */
const PETITION_REFUSED_PATTERN =
  /(denied|denial|refil|re-file|appeal|motion|vague|proposed endeavor|reject(ed|ion)?|turned down|said no|came back negative|not approved|unfavorab|refus(ed|al))/;

/**
 * Work done without authorization, however the person describes it.
 *
 * This is the guardrail that refuses to help conceal facts from USCIS and tells
 * someone to preserve records and get counsel. It needed the words
 * "unauthorized work", "misrepresent", "hide" or "conceal" — the vocabulary of
 * somebody who already knows they have a problem. People describing what actually
 * happened say "freelance", "under the table", "cash", "before my EAD came".
 */
const UNAUTHORIZED_WORK_PATTERN =
  /(misrepresent|hide|hiding|conceal|does not notice|doesn't notice|without authorization|unauthorized work|under the table|off the books|freelanc|side gig|side job|moonlight|paid in cash|cash in hand|contract work|1099|before (my|the) (ead|work permit|card)|while (my|the) (ead|opt|work permit) (was |is )?pending|without a (work )?permit|started working before|worked before)/;

/**
 * CPT, including the school marketing that sells it.
 *
 * Needed the acronym. Somebody who has been told "you can work from day one" by a
 * recruiter often does not know the term yet — and they are precisely the person
 * the guardrail's red-flag list is written for.
 */
const CPT_PATTERN =
  /(\bcpt\b|day 1 cpt|day one cpt|curricular practical|work from day (one|1)|start working (from|in|on) (the )?(first|day one|day 1)|program that lets me work|lets? me work while (i )?stud)/;

/**
 * Beginning work on a pending or expected card.
 *
 * "Pending OPT is not work authorization" is the point of the guardrail, and
 * "my employer wants me to start before my card arrives" is how it gets asked.
 */
const START_WORK_PATTERN =
  /(\bopt\b|\bead\b|work permit|work authorization|\bwork\b|employment|job starts|begin work|start work|start(ing)? (a )?(new )?job|first day|card (arrives|comes|gets here)|before (my|the) card)/;

// Split from classifyTopics so callers can tell "matched nothing" apart from
// "matched the default". Without that distinction a follow-up that matches no
// pattern looks identical to a genuine h1b + adjustment-of-status question.
/**
 * "What do you know about me?" — the trust question.
 *
 * This is what someone asks before deciding whether to type their real
 * immigration situation into a text box, and until now the only phrasing that
 * classified was one containing the literal word "Haven". "Do you have my
 * information?", "what do you know about me", "what data do you have on me" all
 * matched nothing, fell to the unrecognised-question repair, and were answered
 * with the menu of topics.
 *
 * That is the worst available response to this particular question. The Advisor
 * *does* hold the profile — it is loaded before routing, every turn — so a menu
 * reads as evasion about data the product is holding, at the exact moment the
 * user is deciding whether to trust it.
 *
 * Anchored on the object ("me", "about me", "on me", "my information/data"), not
 * on the verb, because the verb varies far more than the object does.
 *
 * Unlike the safety gates in this file, over-triggering here is NOT the safe
 * failure mode, and the difference is worth stating because it inverts the usual
 * rule. An extra safety paragraph costs tokens; a false positive here replaces
 * somebody's immigration answer with a dump of their own profile. A bare
 * `what information do you have` alternative did exactly that to "What
 * information do you have about H-1B transfers?" — caught by the phrasing check
 * before it shipped. Requiring the about-me object in every branch is what keeps
 * the two apart.
 */
const SELF_KNOWLEDGE_OBJECT = String.raw`(about me|on me|of mine|my (information|info|data|details|profile|records?))`;
const SELF_KNOWLEDGE_VERB = String.raw`(know|have|hold|store|stored|see|seen|access|remember|told)`;
const SELF_KNOWLEDGE_PATTERN = new RegExp(
  `((what|which|how much)[^?.!]*\\b${SELF_KNOWLEDGE_VERB}\\b[^?.!]*\\b${SELF_KNOWLEDGE_OBJECT}\\b)` +
    `|(\\b(do|did|can) you\\b[^?.!]*\\b${SELF_KNOWLEDGE_VERB}\\b[^?.!]*\\b${SELF_KNOWLEDGE_OBJECT}\\b)`,
  "i"
);

/**
 * Dangerous beliefs, detected directly rather than as a by-product of a topic.
 *
 * The two myths the PRD names as the reason this product exists — that unpaid
 * work preserves H-1B status, and that a filed LCA means you may start work —
 * were guarded only under the `layoffs` topic. Both arise *before* a layoff, so
 * neither question mentions one, so neither classified:
 *
 *   "My manager offered to keep me on unpaid for a couple of months so my H-1B
 *    stays alive"                       -> topics h1b, zero guardrails
 *   "My new employer says the LCA is
 *    already filed so I'm covered. Can
 *    I start Monday?"                   -> matched nothing at all, and the user
 *                                          was shown the clarifying menu
 *
 * The second is the worse failure. Someone about to work without authorisation on
 * the strength of a misunderstanding was handed a list of topics to choose from.
 *
 * A premise is not a topic. It is a specific false belief that makes an answer
 * dangerous regardless of what the question is nominally about, so it is detected
 * on its own terms and forces both the topic and the guardrail. Over-triggering is
 * the intended failure mode, as everywhere else in this file: an unnecessary
 * paragraph about unpaid work costs a few tokens, and missing one costs status.
 */
const DANGEROUS_PREMISES: Array<{
  id: string;
  /** The belief itself. */
  pattern: RegExp;
  /** A second signal required alongside it, where the first is ambiguous alone. */
  requires?: RegExp;
  topics: TopicBucket[];
  guardrails: string[];
}> = [
  {
    id: "unpaid-preserves-status",
    pattern: /(unpaid|without pay|work(ing)? for free|no salary|not paying me|stop paying me|volunteer(ing)?)/,
    // "Unpaid" alone appears in benign questions about unpaid leave or unpaid
    // invoices. Pairing it with a status word keeps the gate on the myth.
    requires: /(h-?1b|status|visa|stay|sponsor|payroll|employment)/,
    topics: ["layoffs", "h1b"],
    guardrails: ["GR_LAYOFF_SAFETY_RULES"]
  },
  {
    id: "lca-is-protection",
    // Specific enough alone — an LCA only arises in an H-1B context, and the
    // person raising it is almost always about to act on it.
    pattern: /\blca\b|labor condition application/,
    topics: ["h1b", "layoffs"],
    guardrails: ["GR_LAYOFF_SAFETY_RULES"]
  },
  {
    id: "receipt-notice-is-authorisation",
    pattern: /receipt notice|receipt number|i-?797c/,
    requires: /(start|begin|work|portab|transfer|covered|allowed)/,
    topics: ["h1b", "layoffs"],
    guardrails: ["GR_LAYOFF_SAFETY_RULES"]
  }
];

export function detectDangerousPremises(input: string) {
  const normalized = input.toLowerCase();
  return DANGEROUS_PREMISES.filter(
    (premise) => premise.pattern.test(normalized) && (!premise.requires || premise.requires.test(normalized))
  );
}

function detectTopics(input: string): Set<TopicBucket> {
  const normalized = input.toLowerCase();
  const topics = new Set<TopicBucket>();

  // Word boundaries are not cosmetic here. `opt`, `ead`, `cap` and `i-9` were all
  // unanchored, so ordinary English silently misclassified the question:
  //
  //   "What are my options after a layoff?"  -> student-status  (opt in options)
  //   "What is the deadline to file?"        -> work-authorization (ead in deadline)
  //   "My I-94 expires in March."            -> work-authorization (i-9 in i-94)
  //   "capital", "already", "instead", "read", "escape" ... likewise
  //
  // Topics drive retrieval, and retrieval keeps only the top six chunks, so a
  // layoff question containing the words "options" and "deadline" — which is most
  // of them — pulled student-employment and work-authorization sources in place of
  // the ones it needed. This was invisible: the answer still arrived, just built on
  // the wrong material.
  if (/(h-?1b|specialty occupation|transfer|amendment|\bcap\b|grace period)/.test(normalized)) topics.add("h1b");
  if (
    /(visa bulletin|dates for filing|final action)/.test(normalized) ||
    GREEN_CARD_PATH_PATTERN.test(normalized) ||
    PLAIN_QUEUE_PATTERN.test(normalized)
  )
    topics.add("visa-bulletin");
  if (/\bperm\b|labor certification|\bflag(ged|s)?\b/.test(normalized)) topics.add("perm");
  if (/(i-485|i485|adjustment of status|adjust status|advance parole|i-131)/.test(normalized)) topics.add("adjustment-of-status");
  if (/(job change|same or similar|ac21|portability)/.test(normalized)) topics.add("job-change");
  // `day 60` as well as `60-day`. The same near-miss was found once before, in the
  // follow-up chips, and fixed only in guardrail selection — detectTopics still
  // knew one spelling. So "When exactly is my day 60?", which is the grace-period
  // question in its plainest form, matched nothing and was answered with the menu
  // of topics. Someone counting down their own deadline was asked to pick a
  // category.
  if (
    mentionsJobLoss(normalized) ||
    /(60[- ]day|day 60|day sixty|sixty days?)/.test(normalized) ||
    /grace period/.test(normalized) ||
    BRIDGE_STATUS_PATTERN.test(normalized) ||
    mentionsPostLayoffMechanics(normalized)
  )
    topics.add("layoffs");
  if (/(\bf-?1\b|\bopt\b|stem opt|\bcpt\b|i-983|sevis|\bdso\b|ead card)/.test(normalized)) topics.add("student-status");
  if (/(niw|national interest waiver|eb-?1a|eb-?2 niw|proposed endeavor|dhanasar|self.?petition)/.test(normalized)) topics.add("self-petition");
  if (CSPA_PATTERN.test(normalized)) topics.add("cspa");
  if (/(work authorization|employment authorization|unauthorized work|worked without authorization|i-9\b|\bead\b|work permit)/.test(normalized)) topics.add("work-authorization");
  // `uploaded` and `my documents` are here because the product topic otherwise
  // only matched if the user named a Haven surface. "I uploaded my I-797, PERM
  // receipt and I-140 approval — which dates matter if layoffs start?" is a
  // question about their own stored documents that never says "Haven", so it
  // classified as PERM and was answered with "PERM is your employer's job" — on a
  // layoff question.
  //
  // Deliberately narrow. A bare `documents` would catch "what documents do I
  // need?", which is not about their Haven data, and the product topic widens
  // retrieval to the whole corpus.
  if (
    /(haven|timeline|dashboard|planner|inbox|community|uploaded|my documents)/.test(normalized) ||
    SELF_KNOWLEDGE_PATTERN.test(normalized)
  )
    topics.add("haven-product");

  // Last, so a dangerous premise can classify a question that matched nothing
  // else. "My new employer says the LCA is already filed so I'm covered — can I
  // start Monday?" named no topic, so it fell to the clarifying menu: somebody
  // about to work without authorisation on the strength of a misunderstanding was
  // handed a list of topics to choose from.
  for (const premise of detectDangerousPremises(normalized)) {
    for (const topic of premise.topics) topics.add(topic);
  }

  return topics;
}

const DEFAULT_TOPICS: TopicBucket[] = ["h1b", "adjustment-of-status"];

/**
 * Whether one model classification is allowed to replace the pattern router's
 * view of what a question is about, for the purpose of deciding scope.
 *
 * Extracted so the rule can be asserted directly. It was previously three
 * conditions inline in a 200-line function, which is why the two failures it now
 * prevents both survived review: each looked like the other's fix.
 */
export function modelMayDecideScope(input: {
  primaryTopic: TopicBucket | null | undefined;
  confidence: "high" | "low" | undefined;
  patternTopics: TopicBucket[];
  patternsMatched: boolean;
}): boolean {
  const { primaryTopic, confidence, patternTopics, patternsMatched } = input;
  if (!primaryTopic || confidence !== "high") return false;

  // Work authorization is excluded for its own reason, unrelated to the two
  // below: "when can I work again?" is the layoff question, and letting that
  // label drive scope sent people to a message about disclosing past violations.
  if (primaryTopic === "work-authorization") return false;

  // The patterns hit a declined topic, and scope.ts already knows which of those
  // yield and which never do. Replacing that with one label discards the rules.
  if (patternTopics.some((topic) => isRedirectedTopic(topic))) return false;

  // The patterns recognised the question and saw nothing declined; the model
  // wants to decline anyway. Refusing alone is the direction where being wrong
  // costs the person everything, so it takes both.
  if (isRedirectedTopic(primaryTopic) && patternsMatched) return false;

  return true;
}


/**
 * Is this a layoff situation, for the purposes of safety rules?
 *
 * Three call sites — guardrail selection, the required-points checklist and the
 * post-generation addendum — each carried their own copy of this condition, and
 * the copies had already drifted: one knew "h-1b transfer", the other two did
 * not. That drift has bitten this file before, when the checklist asked for one
 * point while the addendum checked six.
 *
 * The topic check alone is not enough and never was: `h1b` is a default topic, so
 * keying on it would put layoff safety rules on every unclassified question. The
 * phrasing check is what makes it a layoff *situation* rather than a question that
 * merely involves H-1B.
 *
 * Post-layoff mechanics are included because somebody asking whether they can
 * start work on a receipt notice is in the middle of exactly the situation these
 * rules exist for, and was getting none of them.
 *
 * `selectGuardrailIds` keeps its own, wider condition on purpose — see the note
 * there. This is the tighter of the two.
 */
/** "day 40", "on day 12", "40 days in", "it has been 40 days". */
const STATED_DAY_COUNT_PATTERN = /\b(?:on )?day \d{1,3}\b|\b\d{1,3} days? (?:in|since|ago|into)\b|\bbeen \d{1,3} days?\b/i;

/** A month name or an ISO/US numeric date the user typed themselves. */
const MENTIONS_A_DATE_PATTERN =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/i;

function isLayoffSituation(normalized: string, topics: TopicBucket[]) {
  if (!topics.includes("h1b") && !topics.includes("layoffs")) return false;
  return (
    mentionsJobLoss(normalized) ||
    /(grace period|60-day|day 60|lca|petition cannot be filed)/.test(normalized) ||
    mentionsPostLayoffMechanics(normalized)
  );
}



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
  /**
   * The person has an open layoff on record.
   *
   * Someone thirty days into a grace period asking a neutrally-worded question is
   * still in a layoff, and nothing in the wording says so.
   */
  hasOpenLayoff?: boolean;
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
  const previousNormalized = previousUserTurn ? previousUserTurn.content.toLowerCase() : null;
  const travelMentioned =
    mentionsTravel(normalized) || (previousNormalized ? mentionsTravel(previousNormalized) : false);
  const jobLossMentioned =
    mentionsJobLoss(normalized) || (previousNormalized ? mentionsJobLoss(previousNormalized) : false);

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
    guardrailIds: selectGuardrailIds(content, topics, { travelMentioned, jobLossMentioned, hasOpenLayoff: input.hasOpenLayoff }),
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
  /**
   * Job loss was raised in this turn *or* the previous user turn.
   *
   * The identical defect on the layoff gate, and the one the codebase already
   * documented once: the classifier was taught to carry the topic across a
   * follow-up because our own chips ("What has to be filed before day 60, and who
   * files it?") restate nothing, but guardrail *selection* was left reading only
   * the current message. So the chips kept the `layoffs` topic and lost
   * GR_LAYOFF_SAFETY_RULES — on the highest-risk question in the product, offered
   * by a button Haven itself renders. Note also that the old trigger list
   * contained "grace period" but not "day 60", which is the exact wording of the
   * chip.
   */
  jobLossMentioned: boolean;
  /**
   * The person has an open layoff on their Haven record.
   *
   * Someone thirty days into a grace period who asks a neutrally-worded question
   * is still in a layoff, and the wording alone would not say so. Optional because
   * the topic-list selector has no profile to read; absent means "not known", never
   * "no".
   */
  hasOpenLayoff?: boolean;
}

/**
 * Choose which guardrails apply to this question.
 *
 * Returns registry ids rather than prose (CD-13.1). Keeping ids here means a trace
 * records *which* rule fired, and a fixture can assert on that instead of grepping
 * the answer for an English phrase that a prompt edit will quietly change.
 */
/**
 * Guardrail selection from an explicit topic list.
 *
 * The signals are re-derived from the query rather than passed in, so the intent
 * router's topics can be run through exactly the same selection the keyword path
 * uses. Two selectors would drift; this is the same one.
 */
export function selectGuardrailIdsForTopics(query: string, topics: TopicBucket[]): string[] {
  const normalized = query.toLowerCase();
  return selectGuardrailIds(query, topics, {
    jobLossMentioned: mentionsJobLoss(normalized),
    travelMentioned: mentionsTravel(normalized)
  });
}

function selectGuardrailIds(query: string, topics: TopicBucket[], signals: GuardrailSignals): string[] {
  const normalized = query.toLowerCase();
  const ids: string[] = [];

  // Premises first. The belief is what makes the answer dangerous, so its
  // guardrail must not depend on the topic conditions below also matching.
  for (const premise of detectDangerousPremises(normalized)) {
    for (const id of premise.guardrails) if (!ids.includes(id)) ids.push(id);
  }

  if (topics.includes("job-change") && /(ac21|same or similar|portability)/.test(normalized)) {
    ids.push("GR_AC21_PORTABILITY");
  }

  if (topics.includes("visa-bulletin") || /(dates for filing|final action|priority date|i-485)/.test(normalized)) {
    ids.push("GR_VISA_BULLETIN_FILING_CHART");
  }

  if (topics.includes("adjustment-of-status") && signals.travelMentioned) {
    ids.push("GR_I485_TRAVEL");
  }

  // Deliberately wider than `isLayoffSituation`, and kept separate from it.
  //
  // This decides whether safety *rules* fire, where over-triggering costs a
  // paragraph. `isLayoffSituation` decides whether retrieval narrows and whether
  // text fixups apply, where over-triggering costs relevance — "what's the
  // deadline for filing my I-485?" should not have its sources cut down to layoff
  // material. Same subject, different tolerance, so they are two predicates with
  // one shared floor rather than one predicate serving both badly.
  //
  // Two questions were sharing one trigger, and the wider one was winning.
  //
  // The old word list included "transfer" and "deadline". Most H-1B transfers have
  // nothing to do with a job loss — they are people changing jobs on purpose — so
  // "How long does an H-1B transfer usually take?" selected the full layoff
  // guardrail and, through it, six mandatory statements: the 60-day grace period,
  // do not work without authorisation, an LCA is not enough, portability needs a
  // properly filed petition, name two options, confirm with counsel. None of them
  // answers how long a transfer takes.
  //
  // That is the whole reason answers run long. Against six specific "state that…"
  // orders, "be concise" cannot win and should not have to — the orders were
  // simply aimed at the wrong question.
  //
  // So the trigger splits by whether this is actually a job-loss situation:
  //
  // - Words that only arise after a job ends — grace period, day 60, last day,
  //   paycheck — plus an explicit mention, plus an open layoff on the person's
  //   record. This is a real layoff and keeps every rule it had.
  // - Words that arise just as often without one — transfer, deadline, what to
  //   file. These get the two rules that genuinely apply to them and no briefing.
  //
  // Nothing is removed from a laid-off person's answer. What changes is that
  // somebody asking a neutral question stops being handed a layoff briefing.
  const layoffOnlyWording =
    /(grace period|60-day|60 day|day 60|paycheck|last day|laid off|terminated|let go|severance|stopped paying|no longer paying|without pay)/.test(
      normalized
    );
  // The ambiguous mechanics belong here, not in the layoff test. "Can I start on
  // the receipt or wait for approval?" names no job loss and is the single most
  // dangerous transfer question in the corpus — it still has to be guarded, just
  // by the three rules that govern starting work rather than by a grace-period
  // briefing that may not apply to them.
  const neutralWording =
    /(transfer|deadline|what to file|who files)/.test(normalized) ||
    POST_LAYOFF_MECHANICS_AMBIGUOUS.some((pattern) => pattern.test(normalized));
  const isJobLossSituation =
    signals.jobLossMentioned || signals.hasOpenLayoff === true || layoffOnlyWording || mentionsDefiniteJobLoss(normalized);

  if ((topics.includes("h1b") || topics.includes("layoffs")) && isJobLossSituation) {
    // The hard rules and the option menu were one guardrail. Split so the rules can
    // repeat on every layoff turn while the menu is delivered once (CD-13.4).
    ids.push("GR_LAYOFF_SAFETY_RULES", "GR_LAYOFF_OPTION_MENU");
    // The option menu offers a B-2 change of status, so the rule that a change of
    // status is not work authorization travels with it (adv-bridge-070).
    ids.push("GR_CHANGE_OF_STATUS_NO_WORK");
  } else if ((topics.includes("h1b") || topics.includes("layoffs")) && neutralWording) {
    // Not a layoff, but still a question where two specific beliefs get people
    // into trouble: that an LCA or a receipt notice is permission to work. Those
    // two rules are the reason "transfer" was on the old list at all, and they are
    // kept — it is the other four, and the option menu, that did not belong.
    ids.push("GR_TRANSFER_BASICS");
  }

  // A conflict between a stated date and a stated day count decides a filing
  // deadline, so it is never safe to resolve silently -- whatever the topic.
  if (STATED_DAY_COUNT_PATTERN.test(normalized) && MENTIONS_A_DATE_PATTERN.test(normalized)) {
    ids.push("GR_STATED_TIMELINE_CONFLICT");
  }

  if (topics.includes("student-status") && START_WORK_PATTERN.test(normalized)) {
    ids.push("GR_OPT_WORK_AUTHORIZATION");
  }

  if (topics.includes("student-status") && CPT_PATTERN.test(normalized)) {
    ids.push("GR_CPT_DAY1");
  }

  if (topics.includes("cspa")) {
    ids.push("GR_CSPA_AGE_OUT");
  }

  if (topics.includes("self-petition") && PETITION_REFUSED_PATTERN.test(normalized)) {
    ids.push("GR_NIW_DENIAL");
  }

  if (topics.includes("work-authorization") && UNAUTHORIZED_WORK_PATTERN.test(normalized)) {
    ids.push("GR_UNAUTHORIZED_WORK");
  }

  // Premises force their guardrails above and the topic conditions can select the
  // same id again. Duplicates would deliver the same paragraph twice.
  return [...new Set(ids)];
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
  // The plainest way anyone asks this, and it matched none of the above. "others
  // in" needed those two words adjacent, so "what did other people in my
  // situation do?" -- the canonical phrasing of the entire feature -- was not an
  // experiential question, retrieved no stories, and (because the stats gate
  // required "what do/should/can", not "what did") returned no statistics either.
  // The purest form of the question got nothing at all.
  if (/(other people|others who|other h-?1b|anyone (who|else|in)|people (who|in) (my|a similar)|what did (people|others|anyone)|how did (people|others|anyone)|what worked for|in (my|a similar) (situation|position|boat|spot))/.test(normalized)) return true;
  return false;
}

/**
 * Should this answer carry community stories?
 *
 * Stories and outcome statistics answer the same question — "what did people like
 * me do?" — but they were gated separately, so "I was laid off, what are my
 * options?" fetched the statistics and no stories. When that segment was too thin
 * for statistics the block rendered NO_STATS, and the user got nothing human at
 * all: no numbers, no experiences, just a hand-off.
 *
 * That fallback is backwards. Statistics need a minimum sample before they mean
 * anything, which is why the tier gate exists. A story needs no sample — one
 * person's experience is legitimately one person's experience, and it is honest
 * precisely because it is not being presented as a rate. So a thin segment should
 * degrade to stories, not to silence.
 */
export function wantsCommunityStories(query: string, topics: TopicBucket[]): boolean {
  return isExperientialQuestion(query) || wantsCaseOutcomeStats(query, topics);
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

/**
 * Does country of birth and preference category change the answer to this question?
 *
 * They do for one class of question and one only: where the person sits in the
 * queue. Country and category jointly determine the priority-date wait, so for a
 * visa-bulletin or CSPA question they are the entire subject, and a story from
 * someone in a different queue is genuinely not comparable.
 *
 * For everything else they are noise. Someone laid off on H-1B faces the same
 * 60-day mechanics whether they were born in China, India, or Brazil, and whether
 * their petition is EB-2 or EB-3 — nothing in the grace period, the portability
 * rule, or the change-of-status options turns on either fact. Segmenting a layoff
 * question by country and category therefore excludes people who went through the
 * identical situation, and does it invisibly: the user sees NO_STATS and concludes
 * nobody like them exists, when what actually happened is that the segment was
 * drawn around a fact irrelevant to their question.
 *
 * The same reasoning would extend to a country-specific restriction — a ban or a
 * per-country rule — if one applied. None currently does in this corpus, and
 * inventing the case here would be guessing.
 */
export function queuePositionMatters(query: string, topics: TopicBucket[]): boolean {
  if (topics.includes("visa-bulletin") || topics.includes("cspa")) return true;

  // Queue vocabulary in the question itself, for the case where classification
  // landed elsewhere. "How long until my green card" is a queue question even when
  // it arrives inside a layoff conversation.
  return /(priority date|retrogress|backlog|visa bulletin|dates for filing|final action|per-?country|country cap|how long.*(green card|gc|wait)|when.*(current|my turn))/i.test(
    query
  );
}

/**
 * The segment used for outcome statistics.
 *
 * Dimensions are included only when they change the answer. The alternative —
 * always segmenting on everything the profile happens to contain — sounds more
 * precise and is not: it splits the sample across facts that do not affect the
 * outcome, so a segment that should have hundreds of comparable cases reports
 * NO_STATS instead. The user is told there is not enough data about people like
 * them, which is false; there was not enough data about a distinction that did not
 * matter.
 */
function buildCaseSegmentFilters(
  profile: HavenWorkspaceSnapshot["profile"],
  query: string,
  topics: TopicBucket[]
): CaseSegmentFilters {
  const queueMatters = queuePositionMatters(query, topics);

  return {
    currentStatus: mapVisa(profile.visaType),
    // Green-card stage stays in for every question. Whether an I-140 is approved
    // genuinely changes what someone can do after a layoff — it is the difference
    // between having a retained priority date and starting over — so it is a real
    // dimension of comparability, not a demographic one.
    i140Status: profile.i140Approved ? "approved" : null,
    nationalityBucket: queueMatters ? bucketNation(profile.countryOfBirth) : null,
    category: queueMatters ? mapCategory(profile.preferenceCategory) : null,
    trigger: "laid_off"
  };
}

// Fire the crowdsourced "what did people like me do?" data path only for layoff / options questions.
export function wantsCaseOutcomeStats(query: string, topics: TopicBucket[]): boolean {
  if (!topics.includes("layoffs")) return false;
  const normalized = query.toLowerCase();
  return (
    isExperientialQuestion(query) ||
    /(what (should|can|do|are)|my options|options after|what now|next step|now what)/.test(normalized)
  );
}

/**
 * Rank a community story by how much it resembles this user's situation.
 *
 * `queueMatters` gates the two demographic dimensions for the same reason
 * `buildCaseSegmentFilters` does. Category used to be weighted +2 — equal to visa
 * type — so on a layoff question a story from another EB-2 applicant outranked a
 * closer account of the same layoff from an EB-3 one, on a distinction that
 * changes nothing about what either person could do in sixty days.
 *
 * Unlike the statistics segment these are soft boosts rather than filters, so the
 * cost of getting it wrong is a worse ordering rather than an empty result. That
 * is also why it is worth getting right: the model is shown three stories, so the
 * ordering decides which experiences the user ever sees.
 */
function scoreProfileMatch(
  tags: string[],
  profile: { visaType: string; preferenceCategory: string; countryOfBirth: string; topConcerns: string[] },
  queueMatters = false
): number {
  const normalized = tags.map(t => t.toLowerCase().replace(/[-_\s]/g, ""));
  let score = 0;

  const visaTag = profile.visaType.toLowerCase().replace(/[-_\s]/g, "");
  if (normalized.some(t => t.includes(visaTag) || visaTag.includes(t))) score += 2;

  if (queueMatters) {
    const catTag = profile.preferenceCategory.toLowerCase().replace(/[-_\s]/g, "");
    if (normalized.some(t => t.includes(catTag) || catTag.includes(t))) score += 2;

    const countryTag = profile.countryOfBirth.toLowerCase().replace(/[-_\s]/g, "");
    if (normalized.some(t => t.includes(countryTag) || countryTag.includes(t))) score += 1;
  }

  // What the user said they are worried about is a better similarity signal than
  // demographics on every question, and it is the only one that is theirs by
  // choice rather than by birth.
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
    // The identity must come from the same persona as the snapshot. An answer
    // addressed to Priya while the profile describes somebody laid off in May is
    // the kind of incoherence that reads as a model failure and is not one.
    const testPersona = resolveTestPersona();
    if (testPersona) {
      return {
        id: testPersona.snapshot.profile.id,
        email: testPersona.snapshot.profile.email,
        fullName: testPersona.snapshot.profile.fullName,
        isMock: true
      };
    }

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

/**
 * Answer "what do you know about me?" from the snapshot, not from the model.
 *
 * Deterministic on purpose. The question is a factual one about our own storage,
 * and it is the one question where a confident invention would be most corrosive:
 * a model that hallucinates a priority date here is not giving a wrong answer
 * about immigration law, it is misrepresenting what the product holds about
 * someone. There is also nothing to reason about, so a model call would add
 * twenty seconds and a failure mode for no gain.
 *
 * Only fields that are actually set are listed. A row reading "Priority date: not
 * set" is noise, and a long list of blanks makes an empty profile look populated.
 */
function buildDataDisclosure(
  profile: HavenWorkspaceSnapshot["profile"],
  rememberedFacts: RememberedFact[]
): string {
  const rows: string[] = [];
  // Several of these fields are stored as enum slugs — `in_progress`,
  // `gc_timeline`, `not_started`. Printing them raw makes the answer read as a
  // database dump at the moment the user is deciding whether to trust the
  // product with more.
  const humanize = (value: string) => value.replace(/_/g, " ");
  const add = (label: string, value: string | null | undefined) => {
    if (value && String(value).trim().length > 0) rows.push(`- **${label}:** ${humanize(String(value))}`);
  };

  add("Visa type", profile.visaType);
  add("Country of birth", profile.countryOfBirth);
  add("Current visa expires", profile.currentVisaExpiryDate);
  add("Employment status", profile.employmentStatus);
  add("Employer", profile.employerName);
  add("Job title", profile.jobTitle);
  add("Green card category", profile.preferenceCategory);
  add("PERM stage", profile.permStage);
  add("Priority date", profile.priorityDate);
  // Booleans are stated in words rather than as true/false, and only when true is
  // not the whole story — "I-140 approved: no" is a fact the user wants confirmed,
  // so both branches are shown for these two.
  add("I-140 approved", profile.i140Approved ? `yes${profile.i140ApprovalDate ? ` (${profile.i140ApprovalDate})` : ""}` : "no");
  add("I-485 filed", profile.i485Filed ? "yes" : "no");
  add("Spouse status", profile.spouseVisaStatus);
  add("What you told us matters most", profile.topConcerns?.join(", "));

  // The user's own sentence, quoted, with the date they said it. A paraphrase
  // here would be the product telling someone what they said, which is exactly
  // the thing this answer exists to let them check.
  const memoryRows = rememberedFacts.map((fact) => {
    const said = fact.createdAt ? fact.createdAt.slice(0, 10) : null;
    return `- "${fact.quote}"${said ? ` — you said this on ${said}` : ""}`;
  });

  if (rows.length === 0 && memoryRows.length === 0) {
    return guardrailText("MSG_DATA_DISCLOSURE_EMPTY");
  }

  const sections: string[] = [];
  if (rows.length > 0) sections.push(["**From your Haven profile**", "", ...rows].join("\n"));
  if (memoryRows.length > 0) {
    sections.push(["**From our earlier conversations**", "", ...memoryRows].join("\n"));
  }
  sections.push(guardrailText("MSG_DATA_DISCLOSURE_CLOSING"));

  return sections.join("\n\n");
}

export function buildAdvisorContext(snapshot: Awaited<ReturnType<typeof getSnapshot>>): AdvisorUserContext {
  const { profile, dashboard, timelineEvents, emailInbox, cohorts, warRoom } = snapshot;

  return {
    gracePeriodSummary: renderGracePeriodForPrompt(readGracePeriod(snapshot.activeLayoffEvent?.layoffDate)),
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

export function buildSuggestedPrompts(snapshot: AdvisorSeedSnapshot, session: AdvisorSessionContext) {
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

/**
 * The user's own dated milestones — their last day, when their grace period ends,
 * what has been filed.
 *
 * This used to return nothing unless the question happened to contain "Haven",
 * "my profile", "dashboard" or "timeline". Sixty answers were read across three
 * laid-off test personas and not one of them named the person's own deadline,
 * because almost nobody phrases an urgent question that way. "When can I start?"
 * does not mention Haven, so the date the whole product exists to track was
 * withheld from the answer — and the model, correctly, then talked about the rule
 * in the abstract.
 *
 * The worst case was the persona whose grace period had already run out and who
 * had a change of status pending inside it: that pending filing is the entire
 * difference between "you are out of status, plan to depart" and "you have a
 * pending application, here is what that means". It was in the timeline, it was
 * not in the prompt, and the answer told him to leave the country.
 *
 * This is the same defect `buildPromptProfileSummary` was already fixed for, one
 * function further down. That comment ends "it could only ever restate the rule in
 * the abstract when the user was asking for their own deadline", which is exactly
 * what was still happening here — the profile dates were let through and the
 * timeline was not.
 *
 * So it now routes by topic like its neighbours: dated milestones reach the
 * date-sensitive topics, and are withheld from everything else. Leakage of the
 * priority date specifically is handled by provenance in
 * `stripUnrequestedPriorityDate`, not by starving the prompt.
 */
/**
 * The 60-day countdown, for the questions it bears on.
 *
 * Gated on the same date-sensitive topics as the timeline, and for the same
 * reason: it is the person's own deadline, so it belongs in any answer about
 * their status and nowhere else. It is not gated on the question mentioning a
 * layoff — somebody four days from their ceiling asking "can I start on the
 * receipt?" needs the count more than the person who says "I was laid off".
 */
export function buildPromptGracePeriod(topics: TopicBucket[], userContext: AdvisorUserContext) {
  const wantsDates = topics.some(
    (topic) => STATUS_DATE_TOPICS.includes(topic) || PRIORITY_DATE_TOPICS.includes(topic)
  );
  return wantsDates ? userContext.gracePeriodSummary : [];
}

export function buildPromptTimelineSummary(query: string, topics: TopicBucket[], userContext: AdvisorUserContext) {
  if (wantsHavenProfileFacts(query)) {
    return userContext.timelineSummary;
  }

  const wantsDates = topics.some(
    (topic) => STATUS_DATE_TOPICS.includes(topic) || PRIORITY_DATE_TOPICS.includes(topic)
  );

  return wantsDates ? userContext.timelineSummary : [];
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
      // Every topic this chunk answers under. The grace-period and portability
      // documents are both h1b and layoffs; filtering on the primary alone left a
      // pure-layoffs question ("I was made redundant, what now?") with zero
      // official documents, served only by the whole-corpus fallback.
      topics: [document.topic, ...(document.additionalTopics ?? [])],
      title: document.title,
      url: document.url,
      agency: source.agency,
      sourceSlug: source.slug,
      agencyArchived: document.agencyArchived
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

  // Bridge status. Added with 8 CFR 248, and without it that document could never
  // be retrieved: a layoff question boosts only chunks matching the grace-period
  // and portability vocabulary above, so the change-of-status regulation scored
  // zero while three older documents scored +8 each and took all six slots.
  //
  // Routing a topic into scope is not the same as making its source reachable.
  // Bridge status was classified correctly from the day it shipped and still
  // answered from the H-1B regulations alone, because retrieval was never told
  // what a bridge question needs.
  if (/\b(b-?2|h-?4|240[- ]day|change of status|cos|i-?539|bridge)\b/.test(normalized)) {
    if (/(change of nonimmigrant classification|248|change of status|dependent nonimmigrant|previously accorded status)/.test(sourceText))
      boost += 8;
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

  if (/(\bopt\b|\bcpt\b|day 1 cpt|\bdso\b|sevis|ead card)/.test(normalized)) {
    if (/(\bopt\b|\bcpt\b|\bdso\b|form i-20|\bead\b|student)/.test(sourceText)) boost += 8;
  }

  if (CSPA_PATTERN.test(normalized)) {
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

export async function retrieveKnowledge(query: string, topics: TopicBucket[], parent?: LangfuseParent) {
  const span = parent?.span({ name: "official-sources-agent", input: { query, topics } });
  const chunks = buildFallbackKnowledgeChunks();
  const normalized = query.toLowerCase();
  const retrievalTopics =
    isLayoffSituation(normalized, topics)
      ? topics.filter((topic) => topic === "h1b" || topic === "layoffs")
      : topics.includes("student-status") && /(\bopt\b|\bcpt\b|day 1 cpt|\bdso\b|sevis|ead card)/.test(normalized)
      ? topics.filter((topic) => topic === "student-status" || topic === "work-authorization")
      : topics;

  const filtered = chunks.filter((chunk) => {
    if (retrievalTopics.includes("haven-product")) return true;
    const chunkTopics = chunk.topics ?? [chunk.topic];
    return retrievalTopics.some((topic) => chunkTopics.includes(topic));
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
  if (!wantsCommunityStories(query, topics)) {
    return [] as RetrievedCommunitySummary[];
  }

  const profile = snapshot.profile;
  const queueMatters = queuePositionMatters(query, topics);
  const span = parent?.span({
    name: "community-story-agent",
    input: {
      query,
      topics,
      experiential: isExperientialQuestion(query),
      forOutcomeQuestion: wantsCaseOutcomeStats(query, topics),
      // On the trace so an over-narrow retrieval can be diagnosed after the fact.
      // The failure this guards against is silent by construction: the user is
      // simply shown fewer stories, and nothing records why.
      queueMatters
    }
  });

  // Vector search path
  if (hasSupabaseEnv && (await hasCommunityAdviceSummaries())) {
    const embedding = await embedQuery(query, span);

    if (embedding) {
      try {
        const admin = createSupabaseAdminClient() as any;
        // `h1b` and `layoffs` are one conversation here, and the topic column is a
        // hard filter rather than a hint — a story labelled `h1b` is invisible to a
        // `layoffs` question and vice versa. Summarising the corpus made that
        // concrete: identical "laid off, bridged to B-2, transferred to a new
        // employer" stories landed in both buckets, because the distinction is
        // genuinely thin. Rather than pretend the labelling can be made perfect,
        // the pair is queried together, which is how the rest of the pipeline
        // already treats them — see STRONG_IN_SCOPE and the retrieval narrowing.
        const requested = topics.filter(t => t !== "haven-product");
        const filterTopics = requested.some(t => t === "h1b" || t === "layoffs")
          ? [...new Set([...requested, "h1b", "layoffs"])]
          : requested;

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
            const profileScore = scoreProfileMatch(item.tags ?? [], profile, queueMatters);
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

  // Fallback: text overlap on snapshot + corpus, deduplicated because the corpus
  // is built from the same snapshot and would otherwise supply every post twice.
  const fallback = dedupeCommunitySummaries([
    ...buildSnapshotCommunitySummaries(snapshot),
    ...buildFallbackCommunitySummaries()
  ])
    .map((item) => ({
      ...item,
      similarity: scoreOverlap(query, `${item.title} ${item.summary} ${item.topic}`) +
        scoreProfileMatch(item.tags ?? [], profile, queueMatters) * 0.05
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

/**
 * Member posts from the live snapshot, as candidate community stories.
 *
 * The title is the post's own title and nothing else. It used to be prefixed
 * with the container it was read from — `Layoff War Room: Day 1 after layoff` —
 * and the model reasonably cited the prefix as the source, so an answer looked
 * like it was resting on a Haven product surface rather than on one member's
 * account. "Layoff War Room" is a page in this product; it is not evidence, and
 * putting its name in front of a colon made it read as one.
 *
 * The cohort name is a worse offender still: `EB-2 India | Approved I-140 |
 * Layoff watch` is a filter definition, and prefixing it onto a story invites
 * the model to present a segment label as a source.
 */
function buildSnapshotCommunitySummaries(snapshot: Awaited<ReturnType<typeof getSnapshot>>) {
  const asSummary = (post: { title: string; body: string; tags: string[] }) => ({
    title: post.title,
    topic: post.tags[0]?.toLowerCase() ?? "community",
    summary: post.body,
    legalCaveat: "Community experiences are anecdotal and may not match your facts.",
    tags: post.tags
  });

  return [...snapshot.cohorts.flatMap((cohort) => cohort.posts.map(asSummary)), ...snapshot.warRoom.posts.map(asSummary)];
}

/**
 * Collapse stories that are the same post reached by two routes.
 *
 * The fallback concatenates the live snapshot with the seed corpus, and the seed
 * corpus is itself built from `havenSnapshot` — so every mock post arrived twice.
 * With the container prefix on one copy and not the other the titles differed,
 * nothing deduplicated them, and the model was handed one story twice and
 * truthfully reported "two posts titled ...". A user reading that concludes two
 * separate people had the same experience, which is the single most misleading
 * thing a community-evidence answer can imply.
 */
function dedupeCommunitySummaries<T extends { title: string; summary: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const item of items) {
    // Keyed on the body rather than the title: the same post reached by two
    // routes may carry two titles, but the story itself is identical.
    const key = item.summary.trim().toLowerCase().slice(0, 200);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
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
      // Haven's own description of the bulletin we hold, not anything the
      // Department of State wrote.
      excerpt: `Bulletin month: ${liveBulletin.bulletinLabel} (${liveBulletin.ageDays} days old).`,
      attribution: "haven-summary",
      citationIndex: 0
    });
  }

  knowledge.forEach((chunk) => {
    const key = `${chunk.title}:${chunk.url}`;
    if (deduped.has(key)) return;

    deduped.set(key, {
      kind: "external",
      // The archived marker rides in the label rather than the excerpt because
      // the label is what a user scanning citations actually reads.
      label: `${chunk.agency} · ${chunk.title}${chunk.agencyArchived ? " (archived by the agency)" : ""}`,
      url: chunk.url,
      // Corpus chunks are Haven's paraphrase of the source ("USCIS frames H-1B
      // as..."), never the agency's own sentences. Marking that here is what lets
      // the UI stop presenting them as the agency's words. If verbatim source text
      // is ever added to the corpus, that is the point to set "verbatim" — from the
      // document, not from a default.
      excerpt: chunk.content,
      attribution: "haven-summary",
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
    `${STALE_BULLETIN_MARKER} ${held}. A newer one has almost certainly been published since, so ` +
    "treat every month-specific cutoff and filing conclusion below as unverified, and check it against the " +
    "[official Visa Bulletin](https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html) " +
    "and the USCIS filing-chart page before you act on any of it."
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
/**
 * The concrete things this particular answer must contain, as a checklist.
 *
 * The requirements already exist — as prose rules in the system prompt, and as
 * conditional guardrail text injected near the top of the user prompt. Both are
 * asking. Measured over three runs, the post-generation addendum still had to
 * staple missing safety language onto 7 of 16 answers, and the two flakiest
 * edge cases were both "the rule is there and the model followed it two times in
 * three".
 *
 * This is the cheap half of enforcing. Same requirements, but stated as a short
 * imperative list and placed last in the prompt, where the model attends most.
 * It does not guarantee anything — nothing does with a language model — and the
 * addendum stays as the backstop. The measure of whether it worked is the
 * addendum firing less often, because every fire is the prompt having failed.
 *
 * Deliberately adjacent to buildMandatorySafetyAddendum: these two must list the
 * same things, and the way that goes wrong is one of them being updated alone.
 */
export function requiredPointsForAnswer(
  question: string,
  topics: TopicBucket[],
  guardrailIds: string[] = []
): string[] {
  const normalized = question.toLowerCase();
  const points: string[] = [];

  // A false premise is corrected first or the rest of the answer is built on it.
  for (const premise of detectDangerousPremises(normalized)) {
    if (premise.id === "unpaid-preserves-status") {
      points.push(
        "Say plainly, before anything else, that unpaid or volunteer work does NOT preserve H-1B status — the classification depends on the employer paying the required wage. Do not soften this into 'may be risky'."
      );
    }
    if (premise.id === "lca-is-protection") {
      points.push(
        "Say plainly that a filed LCA is not permission to work and not a filed petition. Work authorisation under portability starts from a properly filed nonfrivolous H-1B petition, not from the LCA."
      );
    }
    if (premise.id === "receipt-notice-is-authorisation") {
      points.push(
        "Say plainly that a receipt notice is evidence a petition was filed, not the legal event itself, and not a separate grant of permission."
      );
    }
  }

  // Questions that ask for a number nobody can know yet. The failure here is
  // answering anyway; naming the source is the answer.
  const asksForPrediction =
    /(when exactly|what date|how long until|how much longer|will .{0,30}(be current|come current)|when will (i|it|my))/.test(
      normalized
    );
  if (asksForPrediction) {
    points.push(
      "This asks for something you cannot know. Say so in the first sentence, name exactly which fact or which monthly source decides it, and ask for the fact if it is one the user has. Do not estimate, and do not offer a range."
    );
  }

  // Keyed on the guardrail actually selected rather than on a re-derived
  // condition. The first version re-tested the layoff signals here and drifted
  // immediately: "keep me on unpaid so my H-1B stays alive" selects
  // GR_LAYOFF_SAFETY_RULES via its premise but mentions no job loss, so the
  // checklist asked for one point while the addendum checked for six — meaning
  // five were guaranteed to be stapled on rather than written.
  if (guardrailIds.includes("GR_LAYOFF_SAFETY_RULES")) {
    {
      points.push(
        "State the grace period as up to 60 days or until I-94 or petition validity ends, whichever is shorter.",
        "State plainly: do not work without authorisation.",
        "State that LCA preparation alone does not preserve status.",
        "State that portability turns on a properly filed nonfrivolous petition.",
        "Name at least two concrete options — a new employer filing, a change of status, departure and consular return, premium processing.",
        "Tell them to confirm the exact deadline and filing strategy with immigration counsel."
      );
    }
  }

  if (topics.includes("visa-bulletin")) {
    points.push(
      "State that USCIS's monthly filing-chart page decides which chart applies, not the Department of State bulletin alone."
    );
  }

  return points;
}

/**
 * Deletes the answer's repeats before anyone reads them.
 *
 * The prompt has been asked twice, in two different wordings, to say each
 * required line once. Both times the mean answer length barely moved and seven of
 * ten answers still restated "do not work without authorisation" two or three
 * times, usually inside a closing "Final safety reminders" block that also
 * duplicated the citation panel. A model that ignores an instruction twice will
 * ignore it a third time, so this stops asking and does it.
 *
 * Two deliberate limits, because this edits words a person is about to act on:
 *
 * - Only the SECOND and later occurrences are removed, never the first. Whatever
 *   this function does, every required safety line still appears in the answer.
 * - Only whole list items are removed, never part of a sentence. A duplicate
 *   embedded in prose is left alone; a mangled sentence in a legal answer would
 *   be far worse than a repeated one.
 */
const RECAP_HEADING =
  /^\s{0,3}(?:#{1,4}\s*|\*\*)?(?:final (?:safety )?reminders?|safety reminders?|sources(?:\s*\(official\))?|references|summary|recap|key takeaways)\b.*$/i;

const DUPLICATE_LINE_PATTERNS: RegExp[] = [
  /do not work without authoris|do not work without authoriz|don't work without authoris|don't work without authoriz/i,
  /lca[^.]{0,60}(?:does not|doesn't)[^.]{0,30}preserve status/i,
  /confirm[^.]{0,80}(?:deadline|filing strategy)[^.]{0,60}counsel|immigration counsel immediately/i,
  /(?:change of status|b-?2)[^.]{0,120}(?:does not|doesn't)[^.]{0,40}(?:authoris|authoriz|permit|allow)[^.]{0,40}(?:work|employment)/i
];

const LIST_ITEM = /^\s{0,3}(?:[-*+]|\d{1,2}[.)])\s+/;

/**
 * Openings of a trailing offer to do more work.
 *
 * The system prompt has forbidden this in two different wordings and the model
 * ignored both. That is the signal to stop writing rules and cut it in code — the
 * same conclusion this codebase has reached about grace-period arithmetic and
 * about judging a community post: if the behaviour matters, do not leave it to
 * persuasion.
 *
 * Why it matters more than tidiness. The offers are not idle: "I can track and
 * summarize the USCIS filing chart each month for your priority date" describes a
 * standing service Haven will not perform. The conversation ends when the answer
 * does. Somebody who believes a monitor is now running is worse off than before
 * they asked, and on this subject the thing they stopped watching has a deadline.
 */
const TRAILING_OFFER = new RegExp(
  [
    // "If you want, I can…" / "If you'd like, I can…" / "If you want me to…"
    String.raw`if you(?:'d| would)? (?:want|like)(?:\s*,|\s+me\s+to\b)`,
    String.raw`would you like me\b`,
    String.raw`want me to\b`,
    String.raw`shall i\b`,
    String.raw`let me know if\b`,
    String.raw`(?:i'?m )?happy to\b`,
    String.raw`tell me (?:if|whether) you (?:want|would)\b`,
    // A bare "I can:" or "I can also help with:" introducing a menu.
    String.raw`i can(?: also)?(?: help(?: with)?)?\s*:\s*$`
  ]
    // Optional bullet or bold marker in front, and it must open the line — an
    // offer buried mid-sentence is not what this removes.
    .map((pattern) => String.raw`^\s*(?:[*\-\u2022]\s*)?(?:\*\*)?(?:${pattern})`)
    .join("|"),
  "i"
);

/**
 * Cut a trailing offer to do more, and the menu underneath it.
 *
 * Two things this has to get right, and the first version got both wrong:
 *
 * - **The offer usually ends in bullets.** Scanning backwards and stopping at the
 *   first bullet meant the real case — "If you want, I can:" followed by two
 *   options — was never reached. Bullets are collected as candidates and only
 *   discarded once an offer line above them confirms what they belong to.
 * - **"If you want" is usually not an offer.** "If you want to keep working, the
 *   transfer has to be filed first" is advice, and cutting it deletes the sentence
 *   the person needed. The offer forms all point back at Haven — a comma before
 *   "I can", or "me to" — so the pattern requires one.
 *
 * Only ever cuts from the tail, so a conditional in the body is unreachable.
 */
export function stripTrailingOffer(answer: string): string {
  const lines = answer.split("\n");
  const isBullet = (line: string) => /^\s*(?:[*\u2022-]|\d+[.)])\s+/.test(line);

  let cutAt = -1;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.trim()) continue;

    if (TRAILING_OFFER.test(line)) {
      cutAt = index;
      // Keep walking: a menu can be introduced by more than one offer line.
      continue;
    }

    // A bullet might belong to an offer further up, so it is not yet a reason to
    // stop. Anything else is the end of the real answer.
    if (isBullet(line)) continue;
    break;
  }

  if (cutAt === -1) return answer;

  const kept = lines.slice(0, cutAt).join("\n").trimEnd();
  // Never return an empty answer because the whole thing parsed as an offer.
  return kept.length > 0 ? kept : answer;
}

export function stripRedundantRepeats(answer: string): string {
  const lines = answer.split("\n");
  const kept: string[] = [];
  const seen = DUPLICATE_LINE_PATTERNS.map(() => false);
  let droppingRecap = false;

  for (const line of lines) {
    // A recap or sources heading ends the useful answer: drop it and everything
    // under it until a heading that is clearly a different section.
    if (RECAP_HEADING.test(line)) {
      droppingRecap = true;
      continue;
    }
    if (droppingRecap) {
      const isBlank = line.trim().length === 0;
      const isContinuation = isBlank || LIST_ITEM.test(line) || /^\s+/.test(line);
      if (isContinuation) continue;
      droppingRecap = false;
    }

    const patternIndex = DUPLICATE_LINE_PATTERNS.findIndex((pattern) => pattern.test(line));
    if (patternIndex >= 0) {
      if (seen[patternIndex] && LIST_ITEM.test(line)) {
        // Second copy, and it is its own bullet: drop the bullet whole.
        continue;
      }
      seen[patternIndex] = true;
    }

    kept.push(line);
  }

  // Collapse the blank runs the removals leave behind, and never return an empty
  // answer: if something went wrong, the original is the safer output.
  const rebuilt = kept.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
  return rebuilt.trim().length > 0 ? rebuilt : answer;
}

export function buildMandatorySafetyAddendum(
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

  if (isLayoffSituation(normalizedQuestion, topics)) {
    // British spelling, deliberately. The model writes "authorisation" about half
    // the time; every one of those answers was judged to be MISSING the line and
    // had a second copy stapled to the end by the addendum below. Three of the
    // four addendum fires in the 2026-08-20 run were this bug, which also made
    // the reported prompt-compliance rate worse than the truth.
    const missingUnauthorizedWork =
      !/do not work without authoris|do not work without authoriz|don't work without authoris|don't work without authoriz|unauthoris(ed|ation)|unauthoriz(ed|ation)/i.test(
        answer
      );
    const missingLcaWarning = !/lca preparation alone does not preserve status|lca.*not.*preserve status|lca.*not.*filed h-1b petition/i.test(answer);
    const missingImmediateCounsel = !/confirm.*deadline.*counsel|confirm.*filing strategy.*counsel|immigration counsel immediately/i.test(answer);
    // \bdepart\b, not `depart`: the bare alternative matched inside "Department",
    // and "Department of Labor" / "Department of State" appear in a large share of
    // immigration answers. Their presence convinced this check the answer had
    // already offered the fallback options, so FIX_FALLBACK_OPTIONS was suppressed
    // on exactly the layoff answers that needed it — silently, with no error.
    const missingFallbackOptions =
      !/(\bdepartures?\b|\bdepart(s|ing|ed)?\b|leave the u\.s\.|consular|change of status|b-2|premium processing|receipt notice|form i-129)/i.test(answer);
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

  // The answer raised a change of status but never said it does not authorize work.
  // Checked against the answer, not the question: the option usually arrives in the
  // answer's own option menu rather than in what the user asked (adv-bridge-070).
  // Narrowed to where the answer actually puts a change of status on the table.
  // The bare phrase fired on a passing mention — a bulletin-monitoring answer that
  // said "if a layoff happens, consult counsel about change of status" got a
  // stapled warning that B-2 does not authorise work, on a question where nobody
  // had raised B-2 or a layoff. A safety line delivered as a non-sequitur teaches
  // people to skim past the ones that matter.
  const raisesChangeOfStatus =
    /\b(file|filing|apply|applying|submit|switch|switching|change|changing|move|moving|bridge)\b[^.]{0,60}\b(change of status|b-?2|h-?4|i-?539)\b/i.test(answer) ||
    /\b(change of status|b-?2|h-?4|i-?539)\b[^.]{0,60}\b(is an option|as a bridge|before (the|your)|would (let|allow)|lets you|allows you|to remain|to stay)\b/i.test(answer);
  const statesNoWorkOnNewStatus =
    /(change of status|b-?2)[^.]{0,120}(does not|doesn't|will not|won't)[^.]{0,40}(authoris|authoriz|permit|allow)[^.]{0,40}(work|employment)|(does not|doesn't)[^.]{0,60}(authoris|authoriz|permit|allow)[^.]{0,30}(you )?to work/i.test(
      answer
    );
  if (raisesChangeOfStatus && !statesNoWorkOnNewStatus) {
    const texts = take(["FIX_COS_NO_WORK"]);
    if (texts.length > 0) {
      notes.push(["Work authorization note:", ...texts].join(" "));
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

  if (isLayoffSituation(normalizedQuestion, topics)) {
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

/**
 * The system prompt.
 *
 * Rewritten after the narrowing to two topics. The previous version carried
 * fourteen per-topic rule blocks written when the Advisor answered ten topics, and
 * six of them had become unreachable: the scope gate returns before generation for
 * travel, students, AC21, CSPA, NIW and unauthorized-work disclosures, so the model
 * was being handed roughly 700 tokens of instruction about questions it can no
 * longer be asked. Instructions that cannot fire are not free — they compete for
 * attention with the ones that can, and they made the prompt read as a changelog.
 *
 * What replaced them is a short always-on safety floor. The deleted blocks were
 * doing two jobs: teaching topic-specific law, and catching the highest-severity
 * errors. The first job is gone with the topics. The second must survive
 * classification going wrong, which is exactly when a topic-conditional rule is
 * absent — so the floor is unconditional and deliberately short enough to be read.
 *
 * The two in-scope topics keep their rules. The layoff block is trimmed against
 * GR_LAYOFF_SAFETY_RULES, which is injected on every layoff turn and said most of
 * it already; what remains here is the part that must hold even if guardrail
 * selection misses.
 */
export const STREAMING_SYSTEM_PROMPT = [
  // Identity and shape
  "You are Haven Advisor, an information assistant for US employment-based visas and green cards. You are not a lawyer.",
  "Answer in clear markdown, using the official source chunks and Haven profile context provided. Prioritise official sources.",
  "Never invent eligibility rules, filing windows, dates, or conclusions. If the question is too case-specific or risky, give general guidance and recommend attorney review.",

  // Always-on safety floor. Replaces six topic blocks that could not fire, and
  // holds when classification is wrong — which is the moment topic-conditional
  // rules are missing and the user is least protected.
  "SAFETY FLOOR — these hold on every answer, whatever the topic:",
  "Never tell anyone they may work without authorisation, and never suggest unpaid work, volunteer work, or a temporary unpaid role as a way to preserve status.",
  "Never help hide, omit, or misrepresent anything to USCIS, and never draft language that would. If someone appears to have worked without authorisation, do not accuse them: assume an honest mistake, tell them to stop, keep records exactly as they are, and speak to an attorney about disclosure.",
  "Never state a deadline, cutoff, or filing date the user did not give you and no source supports. If a date matters and you do not have it, ask for it or name the source that has it.",
  "Never present a preparation step as a filed one. A drafted LCA, a prepared petition, or documents sitting with an employer are not a filing.",
  "Anything irreversible — leaving the country, resigning, filing, working — gets its risk stated before its convenience.",

  // Profile
  "Use the user's Haven profile only where it is relevant to what they asked. Reference their priority date only for bulletin or green-card-timeline questions, their PERM stage only for PERM or job-change questions. Do not inject profile facts the question did not call for.",
  "User-stated dates always override Haven profile dates. Never insert a profile priority date unless the user asks you to use their Haven profile.",
  // The counterweight to the rule above it. "Only where relevant" was read as
  // "sparingly", and across sixty read answers the model never once used a date
  // from the Haven timeline block — it restated the 60-day rule in the abstract to
  // three different people whose exact deadlines were sitting in the prompt. For
  // the two topics this product covers, the person's own dates are not colour;
  // they are the answer.
  // Asking is cheap; guessing is not. Weekday phrasings ("last Friday") are
  // deliberately not parsed, so this is the path most people's date arrives by.
  "If the answer depends on when their employment ended and no 'Grace period' block is present, ask for the last day of employment in one short line at the end — and say why it changes the answer. Ask once; never open with it, and never withhold the rest of the answer waiting for it.",
  "When the Haven timeline gives a date that bears on the question — their last day of work, when their grace period ends, what has been filed and when — use it explicitly rather than describing the rule in general terms. A person asking about their deadline should be told their deadline. If the timeline shows a pending filing, say what is pending before you describe what happens to someone with nothing pending.",
  "When a profile fact materially changes your answer, name the fact you used and invite correction in one short line — for example 'I am going on your profile saying you are still employed; tell me if that has changed.' A profile is a snapshot the user last edited at some point, and employment status, PERM stage and dates go stale without either side noticing. Do not do this for facts that did not change the answer, and never turn it into a list of everything you hold.",

  // In-scope topic: where am I in the green card line
  "For I-485 filing questions involving Final Action Dates or Dates for Filing, the controlling instruction is USCIS's monthly adjustment filing-chart page — never answer yes or no from the Department of State Visa Bulletin alone. Prefer conditional wording: they may be able to file only if USCIS authorises Dates for Filing for that month and the priority date is earlier than the relevant cutoff, assuming all other eligibility requirements are met. Note the exception: if the category is current on Final Action Dates, or the Final Action cutoff is later than the Dates for Filing date, they may file on Final Action that month.",

  // In-scope topic: I lost my job, how do I stay
  "For layoff, transfer and bridge-status questions, keep the right to remain separate from the right to work. The grace period is up to 60 days or until I-94 or petition validity ends, whichever is shorter — if the I-94 date is later, the 60-day date is the practical deadline. Portability turns on a properly filed nonfrivolous petition; a receipt notice is evidence of filing, not a substitute for it. A change of status to B-2 or H-4 must be filed before the authorised period expires, and neither authorises employment by itself. Do not treat a last paycheck, an employer withdrawal, or a petition in preparation as equivalent to cessation of employment or a filing.",

  // Community evidence — the reason this product exists
  //
  // This section used to say stories were "supplementary" and belonged "always
  // after the official answer". That produced answers that were 90% general rules
  // with an anecdote in the basement: a worse, slower ChatGPT. The rules are the
  // commodity here — every model on earth knows the 60-day grace period. What
  // nobody else has is 200 people who have already been through this, and what
  // they actually did.
  "What makes this product worth using is community stories — what people in the same situation actually did, and how it went. The general rules are not the product: every chatbot knows them, the person could have asked one for free, and reciting them at length is how this answer becomes indistinguishable from the thing they came here instead of. Rules earn their place only where a story cannot be acted on without them.",
  "When stories are provided and genuinely resemble the person's situation, build the answer around them. Lead with what somebody in their position did — their situation, what they actually did, in what order, and how it turned out — in complete sentences, keeping the specifics that make it useful. Then say what it means for this person: what carries over to them, what does not, and what is different about their facts. That comparison is the answer. Do not compress a story into a parenthetical list of keywords.",
  "Name a story by its own title only — never attribute it to a Haven page, cohort, or feature name, which are parts of this product and not sources. If none genuinely fit, say so plainly and keep the general answer short; a stretched story is worse than none, and padding with rules to fill the gap is worse than a short answer.",
  "Never present a story as a rule or a recommendation. It is one person's experience: it shows what was possible for them, not what is permitted, and outcomes vary on facts you cannot see. Say so once, in your own words, rather than hedging every sentence.",
  "For timeline or processing-time questions, official data still governs any number you state — a story is evidence about one case, never about the average.",
  "When a 'Community outcome data' block is provided it contains statistics pre-computed from Haven users in a similar situation. State those figures verbatim; never compute, estimate, round, or extrapolate your own. If it says NO_STATS, say there is not enough data for their profile yet and give general orientation only. Always frame these as what others did, not as a recommendation.",

  // Tone
  "Who you are talking to: most people reach you on a bad day. They were laid off this morning, their status runs out in six weeks, or they have just realised they may have made a mistake. Write for someone reading quickly, frightened, and often in their second or third language.",
  "Never accuse. Assume an honest mistake unless the person says otherwise. Do not open by refusing something they did not ask for, do not imply they were careless, and do not lecture. If you must decline part of a request, say so once, briefly, at the end rather than at the start.",
  "Be warm without being soft. Warmth here is taking the situation seriously and being useful — naming the deadline, saying what to do today. It is not sympathy language, and it is never false reassurance: do not say 'you'll be fine' or 'don't worry'.",
  "You are not a lawyer and must never sound like one. Do not say 'I advise', 'in my legal opinion', or 'you should file'. Say what the rules are, what an attorney would need from them, and what to ask.",
  "If a note about stale Visa Bulletin data appears above your answer, it has already been shown to the user — do not repeat it, and do not open by restating it. Write as though they have read it: keep month-specific cutoffs tentative and say what they should check, without a second disclaimer.",
  "When you are not sure, or the answer depends on something that changes month to month, say so and point to the source instead of guessing. 'The USCIS filing-chart page decides this each month, and here it is' is a better answer than a confident wrong one. Never present a stale or uncertain fact as current.",

  // Length
  // A number, because an adjective loses to a specific instruction every time.
  // Fifteen of the rules in this prompt touch length, and answers still ran
  // 530-725 words of model text. "Be concise" cannot beat "state that X" — one
  // says what to write, the other says how to feel about it.
  "LENGTH BUDGET: aim for under 200 words. A question with a factual answer — how long something takes, whether a document is needed — should be well under that. Only a question that genuinely turns on several dates or conditions earns 300, and nothing earns more. If you are over, the cause is almost always general rules you were not asked for: cut those, never the part specific to this person.",
  "Be concise. Answer the question directly in as few words as it takes to be accurate and complete — no preamble, no restating the question, no filler.",
  "Answer the question that was asked, and stop. If somebody asks how long a transfer takes, tell them how long it takes — do not also brief them on grace periods, work authorisation, and filing strategy because those are adjacent. Adjacent is not relevant, and burying the answer in things they did not ask about is how the one sentence that mattered gets missed.",
  // Answers were averaging ~1,000 words while this file asked for 2-4 sentences.
  // The length was not padding: required safety points and the option menu were
  // each being restated in three or four different sections -- the deadline
  // appearing under "Short answer", again under "Required legal points", again
  // under "What must be filed", again under "Final reminders". Saying each thing
  // once is most of the fix, and it costs nothing in safety, because every
  // required line is still present exactly once.
  "Say each thing once. Do not restate a date, deadline, requirement or warning in more than one place, and never add a closing section that recaps points already made. A required safety line belongs where it is relevant, once — not in a summary and again in a reminder. Someone reading this is frightened and short on time; repetition reads as padding and buries the one sentence that matters.",
  // Both of these duplicate the interface. The app renders official citations in
  // their own panel beside the message, and the composer is right there -- an
  // answer that ends by offering to continue is spending words on a button the
  // person can already see.
  "Do not end with a 'Sources' or 'References' list. Citations belong in the citation payload, which the app displays separately; repeating them as prose adds length and nothing else.",
  "Do not end by offering to do more. No 'if you want, I can…', no menu of things you could do next, no offer to monitor, watch, track, or notify — you cannot do any of those, the conversation ends when this answer does, and offering makes Haven sound like it is about to act on their behalf when nothing will happen. Ask the one question you actually need, as a question, or stop.",
  "A long answer is almost always the wrong answer here. If yours is running long, the cause is nearly always general rules crowding out the part that is specific to this person — cut the rules, not the specifics. Seven numbered sections is a sign something has gone wrong, not a sign of thoroughness.",
  "Lead with the direct answer, then add only the context, caveats, or numbers that materially change what the user should do."
].join(" ");

/**
 * Score the answer before this one, using what the user typed next.
 *
 * Reads the last exchange from the stored thread rather than from the submitted
 * history, because the score has to attach to a trace and only the stored message
 * carries its trace id. That also means it is judging the answer as it was
 * delivered — with the safety addenda and notices appended — rather than whatever
 * the client happens to have in memory.
 *
 * Every path returns quietly. There is no version of this worth surfacing to
 * somebody waiting for an answer about their visa.
 */
/** Record an ending the Advisor chose, without waiting for a reply. */
async function recordImmediateOutcome(traceId: string, outcome: ImmediateOutcome, evidence: string): Promise<void> {
  await recordOutcome({ traceId, outcome, landed: IMMEDIATE_LANDED[outcome], evidence });
}

async function scorePreviousAnswer(input: {
  conversationId?: string;
  userId: string | null;
  followUp: string;
}): Promise<void> {
  if (!input.conversationId || !input.userId) return;

  try {
    const messages = await getThreadMessages(input.userId, input.conversationId);

    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    if (!lastAssistant?.traceId) return;

    // The question that answer was responding to, which is what the follow-up is
    // compared against. Without it a rephrasing cannot be told from a new topic.
    const answerIndex = messages.indexOf(lastAssistant);
    const previousQuestion = [...messages.slice(0, answerIndex)].reverse().find((m) => m.role === "user")?.content;
    if (!previousQuestion) return;

    const read = readAnswerOutcome({
      previousQuestion,
      previousAnswer: lastAssistant.content,
      followUp: input.followUp
    });

    await recordOutcome({
      traceId: lastAssistant.traceId,
      outcome: read.outcome,
      landed: read.landed,
      evidence: read.evidence
    });
  } catch {
    // Intentionally silent — see the doc comment.
  }
}

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

  const { content, history: submittedHistory, conversationId } = parsed.data;

  // The client sends `[...messages, newMessage]`, so the current question arrives
  // inside its own history. Normalising at the boundary keeps "history" meaning
  // "turns before this one" for every caller — see withoutEchoedCurrentTurn for
  // the three things that quietly broke while it did not.
  const rawHistory = withoutEchoedCurrentTurn(content, submittedHistory);

  // Loaded before routing because the profile contributes to it: a pending I-485
  // turns a bare travel question into an adjustment-of-status travel question.
  const snapshot = await getSnapshot();

  const route = routeAdvisorQuestion({
    content,
    history: rawHistory,
    i485Filed: snapshot.profile.i485Filed,
    hasOpenLayoff: Boolean(snapshot.activeLayoffEvent)
  });

  // The intent router, now driving rather than shadowing.
  //
  // Started before moderation and awaited after it, so its ~1s overlaps work that
  // had to happen anyway. Null on failure or timeout, and every use below falls
  // back to the keyword result — a router that could take the Advisor down would
  // be a worse product than the keyword matching it replaces, however much better
  // it classifies.
  // Score the previous answer, now that we can see what the user typed next.
  //
  // This is the only read on whether an answer helped that covers every
  // conversation. The thumbs control covers the few who reach for it, and they are
  // the delighted and the furious. What somebody types next is free, universal,
  // and costs them nothing.
  //
  // Started here and never awaited: it writes to Langfuse and reads one row, and
  // measurement must not be able to delay or fail a reply. It also runs before any
  // of the early-return paths below, so a clarify menu or a scope redirect still
  // scores the turn that preceded it.
  void scorePreviousAnswer({
    conversationId,
    userId: identity.isMock ? null : identity.id,
    followUp: content
  });

  const intentPromise = classifyIntent({ content, history: rawHistory }).catch(() => null);

  const threadState = buildThreadState({
    currentMatched: route.currentMatched,
    previousMatched: route.previousMatched,
    history: rawHistory,
    matches: matchesAnyTopic
  });
  const experiential = isExperientialQuestion(content);
  const model = getChatModel();

  const lf = getLangfuseClient();
  const intentRead = await intentPromise;

  // Three different questions, three different inputs. Keeping them separate is
  // the whole lesson of the shadow phase: acting on one merged topic list would
  // have declined 20 of 61 corpus cases, including almost every layoff question.
  //
  //   safety     the union. Either router may raise a topic, and both must miss
  //              before a user loses a guardrail. Over-triggering is safe here.
  //   scope      the subject only. A layoff question genuinely involves job
  //              change and work authorisation, and tagging those must not
  //              redirect it to the AC21 message.
  //   retrieval  the keyword topics, widened by the subject when the keywords
  //              found nothing. Retrieval keeps six chunks, so adding related
  //              topics dilutes the budget rather than improving it.
  const safetyTopics = intentRead
    ? ([...new Set([...route.topics, ...intentRead.topics])] as TopicBucket[])
    : route.topics;
  // `work-authorization` is excluded from driving scope, and the reason is the
  // same defect this codebase keeps hitting: the label means two things.
  //
  // The model is right that "my OPT is pending and my employer wants me to start"
  // is a work-authorisation question — it is literally about whether they may
  // work. But work-authorization was deliberately taken off the declined list,
  // because for a laid-off person "when can I work again?" is the core question.
  // Letting it drive scope re-introduced exactly the ambiguity that removal
  // resolved: two student cases, one of them the "can I keep working after my OPT
  // expires" safety case, went from declining to being answered.
  //
  // Whether past unauthorised work was disclosed is decided by signal below, and
  // that is the only thing work-authorization should gate.
  //
  // And it may not overrule the patterns on a topic the patterns can see.
  //
  // Measured, not assumed. "I filed B-2 and now I have an offer. Do I wait for
  // the B-2 to be approved first?" was classified six times: four
  // `work-authorization`, two `job-change` at high confidence. The patterns said
  // `layoffs` every time and were right — this is the bridge-status question, the
  // largest cluster in the corpus and squarely in scope. But a high-confidence
  // primaryTopic replaced the pattern topics wholesale, so roughly one user in
  // three asking it was refused and handed an AC21 message about an I-485 they
  // have not filed. Same question, different day, different product. Across five
  // in-scope questions run six times each, 4 of 30 were wrongly refused; with the
  // guard, 0 of 30, on the same classifications.
  //
  // The router earns its place on questions the patterns miss — that is why it was
  // built and it is measurably good at it. Overruling questions the patterns
  // caught is a second power it was never argued for, and it swings both ways: the
  // same override wrongly *answers* "I was laid off and want to use AC21", which
  // scope.ts names as a case that must decline.
  //
  // So the rule is about who saw what, not about which direction the answer went.
  // Declined topics are matched on precise terms; scope.ts already says which of
  // them yield to a strong in-scope signal and which never do. When a pattern has
  // hit one, that decision stands — and when no pattern has, the model does not
  // get to refuse on its own.
  //
  // The rescue case is untouched, which is the point of keying on
  // `route.currentMatched`: a question the patterns did not recognise at all has
  // nothing else to go on, so the model still decides it, decline included.
  const primaryTopic = intentRead?.primaryTopic;

  // The patterns own the scope call whenever they have hit a declined topic.
  //
  // `ac21`, `portability`, `same or similar`, `niw`, `cspa`, `perm` are precise
  // terms — somebody who types one means it — and scope.ts already encodes which
  // of those yield to a strong in-scope signal and which never do. Letting one
  // model call replace that whole decision with a single label discards the
  // yielding rules and swings both ways at once.
  // The two failures are mirror images and neither guard catches both. When the
  // patterns saw no declined topic and the model declines anyway, the model is
  // refusing alone — the B-2 case. When the patterns *did* see one and the model
  // answers anyway, the model is overruling a decline — the AC21 case. Measured
  // separately: the first rule alone fixed 4 of 30 wrongly refused and left AC21
  // wrong 6 of 6; the second alone fixed AC21 and let all 4 back in. Together,
  // 0 of 60.
  const primaryDrivesScope = modelMayDecideScope({
    primaryTopic,
    confidence: intentRead?.confidence,
    patternTopics: route.topics,
    patternsMatched: route.currentMatched
  });
  const scopeTopics = primaryDrivesScope && primaryTopic ? [primaryTopic] : route.topics;
  const topics =
    threadState.resolution === "unmatched" && intentRead?.primaryTopic
      ? ([...new Set([...route.topics, intentRead.primaryTopic])] as TopicBucket[])
      : route.topics;

  // Guardrails are reselected on the union, so a topic only the model saw still
  // brings its safety rules. Selection is pure, so calling it twice is free.
  const guardrailIds = intentRead
    ? [...new Set([...route.guardrailIds, ...selectGuardrailIdsForTopics(content, safetyTopics)])]
    : route.guardrailIds;
  // One trace per message; group a multi-turn conversation via sessionId so
  // each question gets its own clean observation tree instead of piling up.
  const traceId = crypto.randomUUID();
  const trace = lf?.trace({
    id: traceId,
    name: "advisor-session",
    sessionId: conversationId,
    input: { question: content },
    userId: identity.isMock ? undefined : identity.id,
    tags: buildTraceTags(identity),
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

  // Shadow the keyword router with the intent router.
  //
  // Started here and never awaited on the critical path: the comparison is
  // recorded when the answer is already being assembled, so a slow or failed
  // classification costs the user nothing. Nothing downstream reads it. The only
  // output is trace metadata, and the only question this phase answers is how
  // often the two routers disagree on real traffic, and in which direction.
  //
  // `onlyModel` is the number that decides whether this is worth shipping — those
  // are topics a real user raised that the keyword list missed. `onlyKeyword` is
  // the counterweight, and it matters just as much: if the model routinely drops
  // topics the patterns catch, the live design must keep both signals rather than
  // replace one with the other.
  const shadowRouter = classifyIntent({ content, history: rawHistory }).catch(() => null);

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

  // Scope gate — decline the topics this product has not committed to.
  //
  // Placed after moderation and the crisis hand-off, which are safety floors and
  // run regardless of scope, and before generation, because an out-of-scope
  // answer should not cost a model call or twenty seconds. See scope.ts for why
  // these six areas are declined and what each redirect still carries.
  const normalizedContent = content.toLowerCase();
  const scope = decideScope(
    scopeTopics,
    mentionsTravel(normalizedContent),
    UNAUTHORIZED_WORK_PATTERN.test(normalizedContent),
    hasStrongInScopeSignal(normalizedContent),
    detectDangerousPremises(normalizedContent).length > 0
  );
  if (!scope.inScope) {
    const scopePayload: AdvisorAnswerPayload = {
      answer_markdown: guardrailText(scope.guardrailId),
      confidence: "high",
      // The redirects carry their own hand-off to counsel in the copy, where it
      // is specific to the deadline that matters. A generic disclaimer stapled
      // underneath would dilute it into boilerplate.
      disclaimer: "",
      external_citations: [],
      haven_context_used: [],
      community_context_used: [],
      follow_up_questions: [],
      refusal_or_escalation_reason: `Out of scope: ${scope.area}.`
    };

    trace?.update({
      metadata: {
        topics,
        experiential,
        model,
        promptName: ADVISOR_PROMPT_NAME,
        classification: threadState.resolution,
        guardrailsFired: [scope.guardrailId],
        guardrailsSuppressed: [],
        retrievalKnowledgeCount: 0,
        retrievalCommunityCount: 0,
        caseStatsTier: "none",
        citationCount: 0,
        fallback: false,
        fallbackReason: null,
        deterministic: "scope-redirect",
        // The share of real traffic each declined area accounts for is the
        // evidence for which topic comes back first. Without it, re-adding a
        // topic would be decided the same way the original ten were.
        scopeRedirectArea: scope.area
      },
      output: {
        answer: scopePayload.answer_markdown,
        cited: false,
        citationCount: 0,
        refusalOrEscalationReason: scopePayload.refusal_or_escalation_reason
      }
    });
    await flushLangfuse();

    // Declining is the correct answer here and it is still not an answer. Scored
    // so the rate covers every conversation rather than only the ones that reached
    // the model — otherwise the metric quietly improves as Haven answers less.
    void recordImmediateOutcome(traceId, "declined", `Outside scope: ${scope.area}`);

    if (threadId && !identity.isMock) {
      await persistExchange({
        threadId,
        userId: identity.id,
        question: content,
        answer: scopePayload,
        traceId
      });
    }

    yield { type: "delta", text: scopePayload.answer_markdown };
    yield {
      type: "done",
      assistantMessage: createAssistantMessage(displayThreadId, scopePayload, traceId),
      conversationId: threadId,
      traceId
    };
    return;
  }

  // "What do you know about me?" — answered from storage, before generation.
  //
  // Placed ahead of the unmatched repair because this used to *be* an unmatched
  // question: nothing classified, and the user asking what data we hold was shown
  // a menu of immigration topics. See SELF_KNOWLEDGE_PATTERN.
  if (SELF_KNOWLEDGE_PATTERN.test(content)) {
    let facts: RememberedFact[] = [];
    if (!identity.isMock) {
      try {
        facts = await listFacts(identity.id);
      } catch {
        // Memory is an enhancement everywhere else in this file. Here it is part
        // of the answer, so a failure would silently under-report what we hold —
        // the one direction this answer must never be wrong in. Say so instead.
        facts = [];
      }
    }

    const disclosurePayload: AdvisorAnswerPayload = {
      answer_markdown: buildDataDisclosure(snapshot.profile, facts),
      confidence: "high",
      // No legal disclaimer: nothing here is a statement about immigration law,
      // and appending one would make a direct answer read as boilerplate.
      disclaimer: "",
      external_citations: [],
      haven_context_used: [],
      community_context_used: [],
      follow_up_questions: [],
      refusal_or_escalation_reason: undefined
    };

    trace?.update({
      metadata: {
        topics,
        experiential,
        model,
        promptName: ADVISOR_PROMPT_NAME,
        classification: threadState.resolution,
        guardrailsFired: ["MSG_DATA_DISCLOSURE_CLOSING"],
        guardrailsSuppressed: [],
        retrievalKnowledgeCount: 0,
        retrievalCommunityCount: 0,
        caseStatsTier: "none",
        citationCount: 0,
        fallback: false,
        fallbackReason: null,
        // Deterministic answers must be filterable out of prompt-quality metrics.
        // Counting them as model output would quietly inflate every score.
        deterministic: "data-disclosure"
      },
      output: { answer: disclosurePayload.answer_markdown, cited: false, citationCount: 0 }
    });
    await flushLangfuse();

    if (threadId && !identity.isMock) {
      await persistExchange({
        threadId,
        userId: identity.id,
        question: content,
        answer: disclosurePayload,
        traceId
      });
    }

    yield { type: "delta", text: disclosurePayload.answer_markdown };
    yield {
      type: "done",
      assistantMessage: createAssistantMessage(displayThreadId, disclosurePayload, traceId),
      conversationId: threadId,
      traceId
    };
    return;
  }

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

    // An ending the Advisor chose for itself, so it is scored now rather than
    // waiting for a reply that may never come. Neither counts as landing: asking
    // a good clarifying question is right, and the person still does not have an
    // answer.
    void recordImmediateOutcome(traceId, escalate ? "handed-off" : "clarified", repairPayload.refusal_or_escalation_reason ?? "");

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
  // The router is now driving, so this records what it changed rather than what
  // it would have changed. `divergedFromKeyword` is the number to watch on real
  // traffic: it is how often the live decision differs from what the keyword
  // router alone would have produced.
  if (intentRead) {
    const comparison = compareRouters(route.topics, intentRead);
    trace?.span({ name: "intent-router", input: { question: content } })?.end({
      output: {
        keywordTopics: route.topics,
        modelTopics: intentRead.topics,
        primaryTopic: intentRead.primaryTopic,
        confidence: intentRead.confidence,
        agreed: comparison.agreed,
        onlyKeyword: comparison.onlyKeyword,
        onlyModel: comparison.onlyModel,
        safetyTopics,
        scopeTopics,
        retrievalTopics: topics,
        guardrailsFromModelOnly: guardrailIds.filter((id) => !route.guardrailIds.includes(id)),
        divergedFromKeyword: !comparison.agreed,
        requiredSafety: intentRead.requiredSafety,
        factsStated: intentRead.factsStated,
        factsMissing: intentRead.factsMissing,
        premiseToCorrect: intentRead.premiseToCorrect,
        outOfDomain: intentRead.outOfDomain
      }
    });
  }

  const retrievalSpan = trace?.span({ name: "retrieval", input: { topics } });

  // These four were awaited one after another, so every answer paid the sum of
  // four network round trips before the model saw a single token -- including an
  // embedding call inside the community search. None of them reads another's
  // output; they all take the same `content`, `topics` and `snapshot`. Run them
  // together and the cost is the slowest one instead of all of them.
  //
  // Live bulletin stays gated on the topic: only fetched for bulletin questions,
  // so an OPT or layoff answer never carries a bulletin citation it did not use.
  const isBulletinQuestion = topics.includes("visa-bulletin");
  const [knowledge, community, caseStats, liveBulletin] = await Promise.all([
    retrieveKnowledge(content, topics, retrievalSpan),
    retrieveCommunity(content, topics, snapshot, retrievalSpan),
    wantsCaseOutcomeStats(content, topics)
      ? getCaseOutcomeStats(buildCaseSegmentFilters(snapshot.profile, content, topics), retrievalSpan)
      : Promise.resolve(null),
    isBulletinQuestion ? getLiveBulletinSnapshot() : Promise.resolve(null)
  ]);

  // Genuinely dependent: there is no position to render without a live bulletin.
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
  const promptGracePeriod = buildPromptGracePeriod(topics, userContext);
  const promptTimelineSummary = buildPromptTimelineSummary(content, topics, userContext);
  const promptDerivedSignals = buildPromptDerivedSignals(content, topics, userContext);
  const promptEmailEvidence = buildPromptEmailEvidence(content, userContext);
  // Everything the user has already tried in this thread, so the answer stops
  // handing them back a door they told us was locked. Thread-scoped and derived
  // from the history the request already carries — see attempted-steps.ts.
  const attemptedSteps = collectAttempts(content, rawHistory);

  // What the answer is about to assume, and what it does not know.
  //
  // Haven holds a priority date, a category, a status — so unlike a general
  // chatbot it never has to ask, and that is exactly the trap: it inherits
  // whatever was true the last time somebody edited their profile and advises with
  // full confidence on top of it. Held facts get stated back so a wrong one is
  // corrected in the next message; missing ones get asked for, and until they
  // arrive the answer explains rather than recommends.
  const situation = checkSituation(topics, {
    visaType: snapshot.profile.visaType,
    layoffDate: snapshot.activeLayoffEvent?.layoffDate ?? null,
    priorityDate: snapshot.profile.priorityDate,
    preferenceCategory: snapshot.profile.preferenceCategory,
    countryOfBirth: snapshot.profile.countryOfBirth
  });
  const situationLines = renderSituationForPrompt(situation, rawHistory.length === 0);
  const havenContextUsed = promptProfileSummary.slice(0, 4).filter(Boolean);

  const { text: systemPrompt, prompt: advisorPrompt } = await getPrompt(lf, ADVISOR_PROMPT_NAME, STREAMING_SYSTEM_PROMPT);

  // CD-13.1 / CD-13.4: select by id, then resolve to text, dropping orientation the
  // thread has already heard. Hard safety rules are marked `always` in the registry
  // and are never dropped here.
  const guardrails = resolveGuardrails(guardrailIds, threadState.delivered);
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
    // Directly under the question, above the guardrails, for the same reason the
    // grace period sits above the timeline: prompt position is one of the few
    // levers on what actually gets used. Placed further down — after the
    // remembered facts, where it started — the model followed the letter of it
    // (it stopped suggesting the closed step) and skipped the part that matters
    // to the person reading, which is being told it heard them.
    ...(attemptedSteps.length > 0
      ? [buildContextBlock("What the user has already tried", renderAttemptsForPrompt(attemptedSteps)), ""]
      : []),
    ...(situationLines.length > 0
      ? [buildContextBlock("What you know about them, and what you do not", situationLines), ""]
      : []),
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
    // Above the timeline on purpose: it is the fact most likely to change the
    // answer, and prompt position is one of the few levers on what gets used.
    buildContextBlock("Grace period, computed from the date on file", promptGracePeriod),
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
      ? [
          "",
          buildContextBlock(
            "Where they stand in the bulletin (use these numbers; never compute your own, and never paste this block as a list)",
            bulletinPosition
          )
        ]
      : []),
    "",
    buildContextBlock(
      "Official source chunks",
      knowledge.map((item) => `${item.agency} | ${item.title} | ${item.url} | ${item.content}`)
    ),
    "",
    // Rendered as labelled lines rather than pipe-delimited fields.
    //
    // `title | summary | Caveat: ...` reads as a database row, and the model
    // summarised it like one: a 412-character first-person account of what
    // somebody did in the 24 hours after a layoff came back as "(collected
    // I-797s/paystubs, called attorney, tracked job search; emphasizes the 60-day
    // clock)". Every detail worth having — download the documents before HR cuts
    // your access, attorney first and job search third — was compressed out, and
    // what remained was a parenthetical fragment.
    buildContextBlock(
      "Community stories (individual member accounts)",
      community.map((item) =>
        [`Story: ${item.title}`, `What happened: ${item.summary}`, `Caveat: ${item.legalCaveat}`].join("\n")
      )
    ),
    ...(caseStats
      ? [
          "",
          buildContextBlock("Community outcome data (state verbatim; never compute your own numbers)", [
            // The stories block is built above; telling the stats renderer whether
            // it has anything to fall back on is what turns NO_STATS from "say
            // nothing" into "use the individual experiences instead".
            renderStatsForPrompt(caseStats, community.length > 0)
          ])
        ]
      : []),
    "",
    buildContextBlock(
      "Recent conversation",
      history.slice(-6).map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    ),
    // Last, deliberately. The same requirements exist above as prose rules and as
    // guardrail text, and the model followed them most of the time rather than
    // every time. Restating them as a short imperative checklist in the final
    // position is the cheapest lever available on that, and the addendum fire
    // rate is how we find out whether it moved.
    ...(() => {
      const required = requiredPointsForAnswer(content, topics, guardrailIds);
      return required.length > 0
        ? [
            "",
            buildContextBlock(
              "REQUIRED IN THIS ANSWER — check each before you finish",
              required.map((point, index) => `${index + 1}. ${point}`)
            )
          ]
        : [];
    })()
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

  // Stale-bulletin disclosure, emitted BEFORE the answer rather than after it.
  //
  // It used to be stapled to the end, and in a long answer that is where it went
  // to die: a real reply opened with a hard cutoff date and a seven-point action
  // plan built on it, then admitted in its final line that the bulletin behind all
  // of that was 142 days old. A caveat that arrives after somebody has decided
  // what to do has not been delivered. This is the one fact that decides whether
  // any of the rest is safe to act on, so it goes first.
  //
  // Passed an empty answer because there is none yet — that parameter existed to
  // stop the trailing copy duplicating something the model had already said. The
  // system prompt carries the matching instruction not to repeat it below.
  const staleNotice = buildStaleBulletinNotice(topics, knowledge, liveBulletin, "");
  if (staleNotice) {
    const noticeText = `${staleNotice}\n\n`;
    fullText += noticeText;
    yield { type: "delta", text: noticeText };
  }

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

  // Runs before the addendum so the addendum still sees the one surviving copy of
  // each required line and does not staple a replacement for what was just cut.
  fullText = stripRedundantRepeats(fullText);

  // Runs after the repeat pass so it sees the final tail, and before the addendum
  // so the safety lines are not what gets cut.
  fullText = stripTrailingOffer(fullText);

  const addendum = buildMandatorySafetyAddendum(content, topics, fullText, threadState.delivered);
  if (addendum.text) {
    const addendumText = `\n\n${addendum.text}`;
    fullText += addendumText;
    yield { type: "delta", text: addendumText };
  }

  // Attorney handoff.
  //
  // The Advisor recommends counsel constantly and has to — but "talk to an
  // immigration attorney" on its own is the same dead end as "please contact
  // support". This attaches the three things the user cannot assemble alone: a
  // directory link already filtered to their practice area, their own dates to
  // take with them, and questions worth a paid half hour.
  //
  // Appended rather than asked of the model because the link and the dates are
  // facts we hold, and matched against the finished answer rather than decided up
  // front because the recommendation can come from a guardrail or the model.
  const priorAssistantText = rawHistory
    .filter((turn) => turn.role === "assistant")
    .map((turn) => turn.content)
    .join("\n\n");
  const handoff = buildAttorneyHandoff({
    topics,
    answer: fullText,
    context: {
      layoffDate: snapshot.activeLayoffEvent?.layoffDate ?? null,
      priorityDate: snapshot.profile.priorityDate ?? null
    },
    alreadyDelivered: HANDOFF_DELIVERED.test(priorAssistantText)
  });
  if (handoff) {
    const handoffText = `\n\n${handoff.text}`;
    fullText += handoffText;
    yield { type: "delta", text: handoffText };
  }

  // Profile updates the user stated in this message.
  //
  // Written after the answer, never before it. A write that happened first would
  // change the profile the answer was built from, so a mistake would be baked
  // into the reply that announces it.
  //
  // Announced deterministically rather than left to the model. A wrong
  // description of a database write is worse than none — the user would go and
  // correct the wrong field.
  let profileUpdates: ProfileUpdate[] = [];
  if (!identity.isMock) {
    try {
      profileUpdates = filterAlreadyCurrent(
        detectProfileUpdates(content),
        snapshot.profile,
        snapshot.activeLayoffEvent?.layoffDate ?? null
      );

      // The last day of employment is not a profile column — it opens a row in
      // layoff_events, the same record the crisis-mode button writes, so the
      // countdown the dashboard shows and the one in the answer are the same
      // countdown. Split out here rather than inside persistProfileDraft because
      // it is a different table with a different meaning: a profile field is a
      // fact, this starts a clock.
      const layoffUpdate = profileUpdates.find((update) => update.field === "layoffDate");
      const profileFields = profileUpdates.filter((update) => update.field !== "layoffDate");

      if (profileFields.length > 0) {
        await persistProfileDraft(
          identity.id,
          Object.fromEntries(profileFields.map((update) => [update.field, update.value]))
        );
      }

      if (layoffUpdate) {
        const opened = await openLayoffEvent(identity.id, layoffUpdate.value);
        // Announce it only if this call is what created it. An existing open
        // record is left alone — somebody who set a date on the form gave it more
        // thought than a sentence typed in a hurry — and telling them we recorded
        // something we did not would be worse than saying nothing.
        if (!opened?.created) {
          profileUpdates = profileUpdates.filter((update) => update.field !== "layoffDate");
        }
      }
    } catch {
      // A failed write must not cost the user their answer. Nothing is announced
      // in that case, so the profile and what they were told stay consistent.
      profileUpdates = [];
    }
  }

  const updateNotice = renderProfileUpdateNotice(profileUpdates);
  if (updateNotice) {
    fullText += updateNotice;
    yield { type: "delta", text: updateNotice };
  }

  trace?.update({
    output: {
      answer: fullText,
      cited: citations.length > 0,
      citationCount: citations.length,
      profileUpdates: profileUpdates.map((update) => `${update.field}=${String(update.value)}`),
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
      // Counted, not just injected: a thread where the user keeps ruling steps out
      // is a thread that is going badly, and that is only visible if it is recorded.
      attemptedStepCount: attemptedSteps.length,
      situationFactsMissing: situation.missing.map((fact) => fact.label),
      // Recorded so length is watchable next to the outcome score. Nobody would
      // have noticed the 700-word drift without measuring it by hand.
      answerWords: fullText.trim().split(/\s+/).filter(Boolean).length,
      requiredPointCount: requiredPointsForAnswer(content, topics, guardrailIds).length,
      attorneyHandoff: handoff?.practiceArea ?? "none",
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
          additionalTopics: document.additionalTopics ?? [],
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
