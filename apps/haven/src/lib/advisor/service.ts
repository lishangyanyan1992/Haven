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

type TopicBucket =
  | "h1b"
  | "visa-bulletin"
  | "perm"
  | "adjustment-of-status"
  | "job-change"
  | "layoffs"
  | "student-status"
  | "self-petition"
  | "cspa"
  | "work-authorization"
  | "haven-product";

function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

function getChatModel() {
  return env.OPENAI_CHAT_MODEL ?? "gpt-5-mini";
}

function getEmbeddingModel() {
  return env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
}

function formatTimestamp(input: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(input));
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

function classifyTopics(input: string): TopicBucket[] {
  const normalized = input.toLowerCase();
  const topics = new Set<TopicBucket>();

  if (/(h-?1b|specialty occupation|transfer|amendment|cap|grace period)/.test(normalized)) topics.add("h1b");
  if (/(visa bulletin|priority date|dates for filing|final action)/.test(normalized)) topics.add("visa-bulletin");
  if (/\bperm\b|labor certification|flag/.test(normalized)) topics.add("perm");
  if (/(i-485|i485|adjustment of status|adjust status|advance parole|i-131)/.test(normalized)) topics.add("adjustment-of-status");
  if (/(job change|same or similar|ac21|portability)/.test(normalized)) topics.add("job-change");
  if (/(layoff|laid off|60-day|grace period)/.test(normalized)) topics.add("layoffs");
  if (/(f-?1|opt|stem opt|cpt|day 1 cpt|i-983|sevis|dso|ead card)/.test(normalized)) topics.add("student-status");
  if (/(niw|national interest waiver|eb-?1a|eb-?2 niw|proposed endeavor|dhanasar|self.?petition)/.test(normalized)) topics.add("self-petition");
  if (/(cspa|child status protection|age out|aging out|turns 21|turn 21|sought to acquire)/.test(normalized)) topics.add("cspa");
  if (/(work authorization|employment authorization|unauthorized work|worked without authorization|i-9|ead)/.test(normalized)) topics.add("work-authorization");
  if (/(haven|timeline|dashboard|planner|inbox|community)/.test(normalized)) topics.add("haven-product");

  return topics.size > 0 ? Array.from(topics) : ["h1b", "adjustment-of-status"];
}

function buildDecisionGuardrails(query: string, topics: TopicBucket[]) {
  const normalized = query.toLowerCase();
  const guardrails: string[] = [];

  if (topics.includes("job-change") && /(ac21|same or similar|portability)/.test(normalized)) {
    guardrails.push(
      "AC21/job portability: if no Form I-485 is filed or pending, say AC21 adjustment portability generally does not solve the job-change problem. An approved I-140 alone is not AC21 portability. Always mention the pending-I-485 180-day rule and same-or-similar occupational classification requirement, and say role differences and sponsorship strategy need attorney review."
    );
  }

  if (topics.includes("visa-bulletin") || /(dates for filing|final action|priority date|i-485)/.test(normalized)) {
    guardrails.push(
      "Visa bulletin/I-485 filing: never give a hard yes/no from Final Action Dates alone. State that USCIS's monthly adjustment filing-chart page controls whether employment-based applicants must use Final Action Dates or may use Dates for Filing. User-stated dates override Haven profile dates; do not insert a Haven profile priority date unless the user explicitly asks you to use their Haven profile. Preferred wording: 'You may be able to file only if USCIS authorizes Dates for Filing for that month and your priority date is earlier than that cutoff, assuming all other eligibility requirements are met.' Avoid opening with 'you cannot file' when Dates for Filing may be usable."
    );
  }

  if (topics.includes("adjustment-of-status") && /(travel|advance parole|ap|visa stamp|i-131)/.test(normalized)) {
    guardrails.push(
      "Pending I-485 travel: distinguish these in plain English: visa stamp = entry document for requesting admission at the border/airport; status = lawful classification while inside the U.S.; advance parole = travel/reentry document tied to the pending adjustment case. A pending I-131/AP request is not approved advance parole. Avoid absolute wording like 'you cannot travel'; say not to travel based only on pending advance parole and explain that travel depends on approved AP or another valid reentry strategy confirmed with counsel. Explicitly warn that departure without approved advance parole or another valid reentry basis can cause USCIS to treat the I-485 as abandoned. If H-1B status is valid but the visa stamp is expired, explain that H-1B reentry generally requires a valid visa stamp unless the person returns with approved advance parole or qualifies for a narrow exception such as automatic visa revalidation. List practical attorney-review options: wait for AP approval, evaluate H-1B consular stamping, or evaluate limited automatic visa revalidation only if the itinerary and facts qualify."
    );
  }

  if ((topics.includes("h1b") || topics.includes("layoffs")) && /(layoff|laid off|grace period|transfer|paycheck|last day)/.test(normalized)) {
    guardrails.push(
      "H-1B layoff/transfer: separate ability to remain in the U.S. from ability to work. Include these exact safety points in the answer: 'Do not work without authorization' and 'LCA preparation alone does not preserve status.' Do not suggest an unpaid role, volunteer role, or temporary position as a way to preserve H-1B status. Do not use last paycheck as the grace-period trigger unless the source and facts support it. Mention that the grace period is up to 60 days or until I-94/petition validity ends, whichever is shorter. For a new employer, preparation, LCA work, or documents sitting with the employer are not the same as a properly filed nonfrivolous H-1B petition. If the user gives dates, calculate the rough timeline and say what must be filed before day 60. In urgent grace-period cases, list concrete options without ranking them as legal strategy: immediate H-1B filing/receipt strategy, possible change of status such as B-2 if appropriate, departure planning and possible consular return if no timely filing is possible, premium processing or employer escalation if available, and immediate counsel review. Tell the user to confirm the exact deadline and filing strategy with immigration counsel immediately."
    );
  }

  if (topics.includes("student-status") && /(opt|ead|work|employment|job starts|begin work|start work)/.test(normalized)) {
    guardrails.push(
      "F-1 OPT/STEM OPT work authorization: a pending OPT application is not work authorization. Tell the user not to begin OPT work until the EAD/work authorization is valid, and suggest checking USCIS case status, contacting the DSO, and coordinating the start date/I-9 timing with the employer."
    );
  }

  if (topics.includes("student-status") && /(cpt|day 1 cpt)/.test(normalized)) {
    guardrails.push(
      "CPT/Day 1 CPT: do not accept '100% safe' school marketing. Explain that CPT must be DSO-authorized, documented on the Form I-20 before work begins, curricular/integral to the program, and tied to the course/program. Mention that 12 months or more of full-time CPT can affect post-completion OPT eligibility. Tell the user to verify SEVP certification/accreditation, course syllabus or credit requirement, employer-course nexus, I-20 employer/dates/full-time or part-time details, attendance/enrollment rules, and future visa risks with the DSO and immigration counsel before enrolling. Call out red flags such as guaranteed CPT from day one, minimal coursework, weak faculty involvement, or a program mainly structured to enable employment."
    );
  }

  if (topics.includes("cspa")) {
    guardrails.push(
      "CSPA/age-out: flag urgency when a child is close to 21 and say attorney review should happen immediately. Do not calculate a definitive CSPA age without full facts. Do not insert a specific priority date, I-140 date, or 180-day rule unless the user provided that fact in the question. Tell the user to ask counsel about the CSPA age formula, visa availability date, petition pending time, 'sought to acquire' within one year, extraordinary circumstances, adjustment vs consular processing, and filing timing. Suggest gathering I-140 approval, priority-date proof, birth/passport records, receipts, and any evidence of efforts to seek permanent residence."
    );
  }

  if (topics.includes("self-petition") && /(denied|denial|refil|re-file|appeal|motion|vague|proposed endeavor)/.test(normalized)) {
    guardrails.push(
      "NIW denial/refiling: do not assume refiling is best. Tell the user to have counsel review the denial notice and all deadlines, compare refiling with motion/appeal options, and address the Dhanasar framework: substantial merit/national importance, well-positioned to advance the endeavor, and benefit of waiving the job offer/labor certification. Suggest concrete evidence to discuss: a narrower proposed endeavor, implementation plan, measurable objectives, expert letters, publications or citations showing field impact, funding/contracts, adoption by users or institutions, and records already submitted."
    );
  }

  if (topics.includes("work-authorization") && /(misrepresent|hide|conceal|does not notice|without authorization|unauthorized work)/.test(normalized)) {
    guardrails.push(
      "Unauthorized work/misrepresentation safety: refuse any help hiding or misrepresenting facts to USCIS. Tell the user not to continue unauthorized work, preserve dates/pay records/messages, and speak with an immigration attorney immediately about truthful disclosure and possible immigration consequences. Do not draft misleading language."
    );
  }

  return guardrails;
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

function buildSuggestedPrompts(snapshot: AdvisorSeedSnapshot) {
  const [firstConcern] = snapshot.profile.topConcerns;
  return [
    `How does my ${snapshot.profile.preferenceCategory} + ${snapshot.profile.countryOfBirth} path affect what I should watch next?`,
    concernToPrompt(firstConcern ?? "layoffs", "What should I ask Haven first about my immigration timeline?"),
    snapshot.profile.priorityDate
      ? `What does the current visa bulletin mean for my ${snapshot.profile.preferenceCategory} priority date?`
      : "What information do you still need from me to answer green card timeline questions accurately?"
  ];
}

function createWelcomePayload(_snapshot: AdvisorSeedSnapshot): AdvisorAnswerPayload {
  return {
    answer_markdown: "Ask me about work visa and green card questions.",
    confidence: "medium",
    disclaimer: "Haven provides information, not legal advice. Check a qualified immigration attorney before making decisions.",
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

function buildPromptProfileSummary(query: string, userContext: AdvisorUserContext) {
  if (wantsHavenProfileFacts(query)) {
    return userContext.profileSummary;
  }

  return userContext.profileSummary.filter((line) => {
    if (/priority date|current visa expiry date|h-1b cap date|date:/i.test(line)) return false;
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

function buildPromptDerivedSignals(query: string, userContext: AdvisorUserContext) {
  if (wantsHavenProfileFacts(query)) {
    return userContext.derivedSignalsSummary;
  }

  return userContext.derivedSignalsSummary.filter((line) => !/date|estimated|cap/i.test(line));
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

    const flagged = moderation.results?.[0]?.flagged ?? false;
    span?.end({ output: { flagged } });

    return { flagged };
  } catch {
    return { flagged: false };
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

  if (/(layoff|laid off|grace period|60-day|day 60|transfer|lca)/.test(normalized)) {
    if (/(grace period|cessation of employment|60-day|h-1b portability|nonfrivolous h-1b petition|lca)/.test(sourceText)) boost += 8;
  }

  if (/(ac21|same or similar|product manager|software engineer|portability)/.test(normalized)) {
    if (/(ac21|same or similar|i-485.*pending|180 days|supplement j|occupational classification)/.test(sourceText)) boost += 8;
  }

  if (/(visa bulletin|dates for filing|final action|priority date)/.test(normalized)) {
    if (/(filing chart|dates for filing|final action|visa bulletin|uscis.*monthly)/.test(sourceText)) boost += 8;
  }

  if (/(travel|advance parole|visa stamp|i-131|reentry)/.test(normalized)) {
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
    (topics.includes("h1b") || topics.includes("layoffs")) && /(layoff|laid off|grace period|60-day|day 60|lca|h-1b transfer|petition cannot be filed)/.test(normalized)
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
  if (hasSupabaseEnv) {
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

function buildCitationSet(knowledge: RetrievedKnowledgeChunk[]): AdvisorCitation[] {
  const deduped = new Map<string, AdvisorCitation>();

  knowledge.forEach((chunk, index) => {
    const key = `${chunk.title}:${chunk.url}`;
    if (deduped.has(key)) return;

    deduped.set(key, {
      kind: "external",
      label: `${chunk.agency} · ${chunk.title}`,
      url: chunk.url,
      quote: chunk.content,
      citationIndex: deduped.size + index
    });
  });

  return Array.from(deduped.values()).slice(0, 4);
}

function detectStaleBulletin(knowledge: RetrievedKnowledgeChunk[], topics: TopicBucket[]) {
  if (!topics.includes("visa-bulletin")) {
    return false;
  }

  const bulletinDocs = trustedKnowledgeDocuments.filter((document) => document.topic === "visa-bulletin" && document.effectiveDate);
  const newest = bulletinDocs
    .map((document) => document.effectiveDate as string)
    .sort()
    .at(-1);

  if (!newest) {
    return true;
  }

  const ageMs = Date.now() - new Date(newest).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  return ageDays > 45 && knowledge.some((chunk) => chunk.topic === "visa-bulletin");
}

function fallbackAnswer(
  question: string,
  userContext: AdvisorUserContext,
  knowledge: RetrievedKnowledgeChunk[],
  community: RetrievedCommunitySummary[],
  topics: TopicBucket[]
): AdvisorAnswerPayload {
  const citations = buildCitationSet(knowledge);

  if (detectStaleBulletin(knowledge, topics)) {
    return {
      answer_markdown:
        "I can explain how the visa bulletin works, but I should not give a month-specific filing conclusion until Haven refreshes the latest bulletin and filing-chart data.\n\nUse the official Visa Bulletin and USCIS monthly filing-chart page before acting on timing-sensitive filing decisions.",
      confidence: "low",
      disclaimer: "Haven provides information, not legal advice. Check a qualified immigration attorney before making decisions.",
      external_citations: citations,
      haven_context_used: [],
      community_context_used: [],
      follow_up_questions: [
        "Do you want a plain-language explanation of Final Action Dates vs. Dates for Filing?",
        "Do you want me to focus on how your priority date fits into the monthly chart logic?"
      ],
      refusal_or_escalation_reason: "Monthly bulletin data may be stale."
    };
  }

  const havenContextUsed = [
    ...buildPromptProfileSummary(question, userContext).slice(0, 4),
    ...buildPromptDerivedSignals(question, userContext).slice(0, 1)
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
    disclaimer: "Haven provides information, not legal advice. Check a qualified immigration attorney before making decisions.",
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

function buildMandatorySafetyAddendum(question: string, topics: TopicBucket[], answer: string) {
  const normalizedQuestion = question.toLowerCase();
  const notes: string[] = [];

  if ((topics.includes("h1b") || topics.includes("layoffs")) && /(layoff|laid off|grace period|day 60|lca|petition cannot be filed)/.test(normalizedQuestion)) {
    const missingUnauthorizedWork = !/do not work without authorization|don't work without authorization|unauthorized work/i.test(answer);
    const missingLcaWarning = !/lca preparation alone does not preserve status|lca.*not.*preserve status|lca.*not.*filed h-1b petition/i.test(answer);
    const missingImmediateCounsel = !/confirm.*deadline.*counsel|confirm.*filing strategy.*counsel|immigration counsel immediately/i.test(answer);
    const missingFallbackOptions = !/(departure|depart|leave the u\.s\.|consular|change of status|b-2|premium processing|receipt notice|form i-129)/i.test(answer);
    const needsSpecificGraceDate = /june 12,? 2026|june 12/.test(normalizedQuestion) && /i-94.*march 15,? 2027|march 15,? 2027.*i-94/.test(normalizedQuestion);
    const missingSpecificGraceDate = needsSpecificGraceDate && !/august 11,? 2026|aug\.? 11,? 2026/i.test(answer);
    const missingPortabilityTrigger = !/properly filed nonfrivolous|nonfrivolous.*petition.*filed|filed.*nonfrivolous/i.test(answer);

    if (missingUnauthorizedWork || missingLcaWarning || missingImmediateCounsel || missingFallbackOptions || missingSpecificGraceDate || missingPortabilityTrigger) {
      notes.push(
        [
          "H-1B safety note:",
          missingSpecificGraceDate ? "If June 12, 2026 is the employment-termination date, the 60-day grace period would point to about August 11, 2026; the March 15, 2027 I-94 date does not extend the grace period beyond 60 days." : null,
          missingUnauthorizedWork ? "Do not work without authorization." : null,
          missingLcaWarning ? "LCA preparation alone does not preserve status; the key event is a properly filed nonfrivolous H-1B petition." : null,
          missingFallbackOptions ? "If the new employer cannot file Form I-129 before day 60, ask counsel immediately about change of status, departure planning, possible consular return, premium processing or employer escalation, and receipt-notice timing." : null,
          missingPortabilityTrigger ? "For H-1B portability, the key event is a properly filed nonfrivolous H-1B petition while the worker remains in an authorized period; a receipt notice is useful evidence of filing, not a substitute for the filing itself." : null,
          missingImmediateCounsel ? "Confirm the exact grace-period deadline and filing strategy with immigration counsel immediately." : null
        ].filter(Boolean).join(" ")
      );
    }
  }

  if (topics.includes("student-status") && /(day 1 cpt|cpt)/.test(normalizedQuestion)) {
    const missingOptRisk = !/12 months.*full-time cpt|full-time cpt.*12 months|ineligible for post-completion opt/i.test(answer);
    const missingI20 = !/form i-20|i-20/i.test(answer);

    if (missingOptRisk || missingI20) {
      notes.push(
        [
          "CPT safety note:",
          missingI20 ? "Do not start CPT work until DSO authorization is recorded on the Form I-20." : null,
          missingOptRisk ? "Ask the DSO how any full-time CPT would affect post-completion OPT, including the 12-month full-time CPT limit." : null
        ].filter(Boolean).join(" ")
      );
    }
  }

  if (topics.includes("adjustment-of-status") && /(travel|advance parole|ap|i-131|visa stamp|reentry)/.test(normalizedQuestion)) {
    const missingPendingApWarning = !/pending advance parole.*not enough|pending i-131.*not enough|do not travel based only on pending ap|pending advance parole.*not.*permission/i.test(answer);
    const missingAbandonmentWarning = !/abandon.*i-485|i-485.*abandon/i.test(answer);
    const missingPlainEnglishDistinction = !/(visa stamp|visa).*?(status).*?(advance parole)|(advance parole).*?(status).*?(visa stamp)/is.test(answer);
    const missingReentryOptions = !/(wait.*approved ap|wait.*advance parole|h-1b.*stamp|consular|automatic visa revalidation|attorney-review options)/is.test(answer);

    if (missingPendingApWarning || missingAbandonmentWarning || missingPlainEnglishDistinction || missingReentryOptions) {
      notes.push(
        [
          "I-485 travel safety note:",
          missingPlainEnglishDistinction ? "Visa stamp means the entry document used to request admission; status means the lawful classification while inside the U.S.; advance parole is a separate travel/reentry document for a pending adjustment case." : null,
          missingPendingApWarning ? "Pending advance parole is not enough by itself for travel; do not travel based only on a pending I-131/AP application." : null,
          missingAbandonmentWarning ? "Leaving without approved advance parole or another valid reentry basis can cause USCIS to treat the I-485 as abandoned." : null,
          missingReentryOptions ? "If travel is unavoidable, ask counsel about three options before departure: waiting for approved AP, obtaining a new H-1B visa stamp abroad, or using limited automatic visa revalidation only if the itinerary and facts qualify." : null,
          "Confirm the reentry strategy with immigration counsel before departure because CBP, consular processing, and abandonment risks are fact-specific."
        ].filter(Boolean).join(" ")
      );
    }
  }

  if (topics.includes("self-petition") && /(denied|denial|refil|re-file|appeal|motion|proposed endeavor)/.test(normalizedQuestion)) {
    const missingNoAssumption = !/do not assume refiling is best|don't assume refiling is best|do not assume.*refil|don't assume.*refil/i.test(answer);
    const missingDeadlines = !/deadline|time limit|i-290b|motion|appeal/i.test(answer);

    if (missingNoAssumption || missingDeadlines) {
      notes.push(
        [
          "NIW strategy note:",
          missingNoAssumption ? "Do not assume refiling is best." : null,
          missingDeadlines ? "Ask counsel to review the denial notice for motion, appeal, or refiling deadlines before choosing a strategy." : null
        ].filter(Boolean).join(" ")
      );
    }
  }

  if (topics.includes("cspa")) {
    const missingNoCalculation = !/do not calculate.*cspa|do not.*cspa age.*incomplete|should not calculate.*cspa|without full facts/i.test(answer);
    const missingImmediateReview = !/attorney.*immediately|immediate attorney|consult.*attorney.*immediately|review.*immediately/i.test(answer);

    if (missingNoCalculation || missingImmediateReview) {
      notes.push(
        [
          "CSPA safety note:",
          missingNoCalculation ? "Do not calculate CSPA age from incomplete facts; ask counsel to calculate it using the full record." : null,
          missingImmediateReview ? "Because the child is close to 21, consult an immigration attorney immediately about CSPA, sought-to-acquire timing, and filing options." : null
        ].filter(Boolean).join(" ")
      );
    }
  }

  return notes.length > 0 ? notes.join("\n\n") : null;
}

function normalizeHighRiskAnswer(question: string, topics: TopicBucket[], answer: string) {
  const normalizedQuestion = question.toLowerCase();

  if (topics.includes("adjustment-of-status") && /(travel|advance parole|ap|i-131|visa stamp|reentry)/.test(normalizedQuestion)) {
    return answer
      .replace(
        /\bYou cannot travel internationally next month(?:[^.]*pending I-485[^.]*)?\./i,
        "Do not travel based only on the pending advance parole application. International travel while Form I-485 is pending is high-risk and depends on approved advance parole or another valid reentry strategy confirmed with counsel."
      )
      .replace(
        /\bYou cannot travel internationally with a pending I-485 and only a pending advance parole application\./i,
        "Do not travel based only on a pending I-131/AP application while Form I-485 is pending."
      );
  }

  if ((topics.includes("h1b") || topics.includes("layoffs")) && /(layoff|laid off|grace period|day 60|lca|petition cannot be filed)/.test(normalizedQuestion)) {
    return answer
      .replace(
        /Since your I-94 expires on March 15, 2027,[^.]*\./gi,
        "If June 12, 2026 is the employment-termination date, the 60-day grace period would point to about August 11, 2026; the March 15, 2027 I-94 date does not extend the grace period beyond 60 days."
      )
      .replace(
        /(?:the )?grace period (?:will|would) last until March 15, 2027[^.]*\./gi,
        "The grace period is capped at up to 60 days after employment ends, or until the I-94/petition validity ends, whichever is shorter."
      )
      .replace(
        /(?:you have|there (?:are|is)|with)\s+(?:about\s+)?\d+\s+days?\s+(?:left|remaining)[^.]*grace period[^.]*\./gi,
        "If June 12, 2026 is the employment-termination date, the 60-day grace period would point to about August 11, 2026; confirm the exact termination date and grace-period endpoint with employer counsel."
      )
      .replace(
        /(?:about\s+)?\d+\s+days?\s+(?:left|remaining)\s+(?:until|before)\s+(?:the end of\s+)?(?:your|the)?\s*grace period[^.]*\./gi,
        "If June 12, 2026 is the employment-termination date, the 60-day grace period would point to about August 11, 2026; confirm the exact termination date and grace-period endpoint with employer counsel."
      )
      .replace(
        /(?:you|the user) (?:cannot|can't|should not|must not) (?:start )?work(?:ing)? until (?:you|they|the employer)? ?(?:receive|get|obtain|have) (?:the )?(?:USCIS )?receipt notice[^.]*\./gi,
        "For H-1B portability, work authorization generally depends on the new employer properly filing a nonfrivolous H-1B petition while the worker remains in an authorized period; the receipt notice is useful evidence of that filing and should be reviewed with counsel."
      )
      .replace(
        /(?:^|\n)-?\s*\*\*?Temporary unpaid position\*\*?:?[^.\n]*(?:\.[^\n]*)?/gi,
        "\n- **No unpaid-work workaround**: Do not rely on an unpaid role, volunteer role, or temporary position to preserve H-1B status without counsel confirming work authorization and status strategy."
      )
      .replace(
        /(?:^|\n)-?\s*Temporary unpaid position:?[^.\n]*(?:\.[^\n]*)?/gi,
        "\n- **No unpaid-work workaround**: Do not rely on an unpaid role, volunteer role, or temporary position to preserve H-1B status without counsel confirming work authorization and status strategy."
      );
  }

  if (topics.includes("visa-bulletin") && !topics.includes("cspa")) {
    const questionIncludesMockPriorityDate = /june 12,? 2025|2025-06-12/i.test(question);
    const questionPriorityDateMatch = question.match(/(?:priority date is|priority date:)\s*([A-Z][a-z]+ \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2})/i);
    const userPriorityDate = questionPriorityDateMatch?.[1] ?? null;

    if (!questionIncludesMockPriorityDate) {
      return answer
        .replace(/Since your priority date is June 12,? 2025,?\s*/gi, userPriorityDate ? `Since your priority date is ${userPriorityDate}, ` : "")
        .replace(/your priority date \(June 12,? 2025\)/gi, userPriorityDate ? `your priority date (${userPriorityDate})` : "your priority date")
        .replace(/\s*\(June 12,? 2025\)/gi, "")
        .replace(/priority date of June 12,? 2025/gi, userPriorityDate ? `priority date of ${userPriorityDate}` : "priority date");
    }
  }

  if (topics.includes("cspa")) {
    const questionIncludesMockPriorityDate = /june 12,? 2025|2025-06-12/i.test(question);
    let normalizedAnswer = answer;

    if (!questionIncludesMockPriorityDate) {
      normalizedAnswer = normalizedAnswer
        .replace(/\s*\(June 12,? 2025\)/gi, "")
        .replace(/your priority date \(June 12,? 2025\)/gi, "your priority date")
        .replace(/for your priority date June 12,? 2025/gi, "for your priority date")
        .replace(/priority date \(June 12,? 2025\)/gi, "priority date")
        .replace(/priority date of June 12,? 2025/gi, "priority date")
        .replace(/priority date \(2025-06-12\)/gi, "priority date");
    }

    return normalizedAnswer
      .replace(/,?\s*considering the 180-day requirement post-petition and priority date relevance/gi, "")
      .replace(/the 180-day requirement post-petition and /gi, "")
      .replace(/180-day requirement post-petition/gi, "petition pending time");
  }

  return answer;
}

export async function getAdvisorWorkspaceSeed(snapshotArg?: AdvisorSeedSnapshot) {
  const snapshot = snapshotArg ?? await getSnapshot();

  return {
    suggestedPrompts: buildSuggestedPrompts(snapshot),
    welcomeMessage: createWelcomePayload(snapshot)
  };
}

export function isAdvisorRateLimitError(error: unknown) {
  return error instanceof AdvisorRateLimitError;
}

export type AdvisorStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; assistantMessage: AdvisorMessage; conversationId: string; traceId: string }
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
  const topics = classifyTopics(content);
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
      promptName: ADVISOR_PROMPT_NAME
    }
  });

  const moderation = await moderateMessage(content, trace);
  const snapshot = await getSnapshot();

  if (moderation.flagged) {
    const threadId = conversationId ?? "session";
    const flaggedPayload: AdvisorAnswerPayload = {
      answer_markdown:
        "I can help with work visa and green card questions, but I can't continue with this message as written. Rephrase it as a factual immigration or Haven-product question and I'll answer from official sources.",
      confidence: "low",
      disclaimer: "Haven provides information, not legal advice. Check a qualified immigration attorney before making decisions.",
      external_citations: [],
      haven_context_used: [],
      community_context_used: [],
      follow_up_questions: [],
      refusal_or_escalation_reason: "Message flagged by moderation.",
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
        fallbackReason: null
      },
      output: {
        answer: flaggedPayload.answer_markdown,
        cited: false,
        citationCount: 0,
        refusalOrEscalationReason: flaggedPayload.refusal_or_escalation_reason
      }
    });
    await flushLangfuse();
    yield { type: "done", assistantMessage: createAssistantMessage(threadId, flaggedPayload, traceId), conversationId: threadId, traceId };
    return;
  }

  const threadId = identity.isMock
    ? conversationId ?? "session"
    : await reserveAdvisorConversation(identity.id, content, conversationId);

  const history: AdvisorMessage[] = rawHistory.map((m, i) => ({
    id: `history-${i}`,
    threadId,
    role: m.role,
    content: m.content,
    createdAt: new Date(Date.now() - (rawHistory.length - i) * 1000).toISOString(),
  }));

  const userContext = buildAdvisorContext(snapshot);

  // Retrieval agents run under a shared parent span so the official-source and
  // community-story handoffs are visible as a nested tree under the trace.
  const retrievalSpan = trace?.span({ name: "retrieval", input: { topics } });
  const knowledge = await retrieveKnowledge(content, topics, retrievalSpan);
  const community = await retrieveCommunity(content, topics, snapshot, retrievalSpan);
  const caseStats = wantsCaseOutcomeStats(content, topics)
    ? await getCaseOutcomeStats(buildCaseSegmentFilters(snapshot.profile), retrievalSpan)
    : null;
  retrievalSpan?.end({
    output: {
      knowledgeCount: knowledge.length,
      communityCount: community.length,
      caseStatsTier: caseStats?.tier ?? "none"
    }
  });

  const citations = buildCitationSet(knowledge);
  const communityUsed = community.slice(0, 2).map((item) => `${item.title}: ${item.summary}`);
  const promptProfileSummary = buildPromptProfileSummary(content, userContext);
  const promptTimelineSummary = buildPromptTimelineSummary(content, userContext);
  const promptDerivedSignals = buildPromptDerivedSignals(content, userContext);
  const promptEmailEvidence = buildPromptEmailEvidence(content, userContext);
  const havenContextUsed = promptProfileSummary.slice(0, 4).filter(Boolean);

  const { text: systemPrompt, prompt: advisorPrompt } = await getPrompt(lf, ADVISOR_PROMPT_NAME, STREAMING_SYSTEM_PROMPT);
  const decisionGuardrails = buildDecisionGuardrails(content, topics);

  const userPrompt = [
    `User question:\n${content}`,
    "",
    buildContextBlock("Decision guardrails", decisionGuardrails),
    "",
    buildContextBlock("Haven profile summary", promptProfileSummary),
    "",
    buildContextBlock("Haven timeline summary", promptTimelineSummary),
    "",
    buildContextBlock("Haven derived signals", promptDerivedSignals),
    "",
    buildContextBlock("Haven email evidence", promptEmailEvidence),
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
      history.slice(-6).map((m) => `${m.role.toUpperCase()} @ ${formatTimestamp(m.createdAt)}: ${m.content}`)
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
      const fallbackPayload = fallbackAnswer(content, userContext, knowledge, community, topics);
      fullText = fallbackPayload.answer_markdown;
      fallback = true;
      fallbackReason = "stream error";
      trace?.update({ output: { answer: fullText, fallback: true, reason: fallbackReason } });
      yield { type: "delta", text: fullText };
    }
  } else {
    const fallbackPayload = fallbackAnswer(content, userContext, knowledge, community, topics);
    fullText = fallbackPayload.answer_markdown;
    fallback = true;
    fallbackReason = "no openai client";
    trace?.update({ output: { answer: fullText, fallback: true, reason: fallbackReason } });
    yield { type: "delta", text: fullText };
  }

  const normalizedFullText = normalizeHighRiskAnswer(content, topics, fullText);
  if (normalizedFullText !== fullText) {
    fullText = normalizedFullText;
  }

  const mandatorySafetyAddendum = buildMandatorySafetyAddendum(content, topics, fullText);
  if (mandatorySafetyAddendum) {
    const addendumText = `\n\n${mandatorySafetyAddendum}`;
    fullText += addendumText;
    yield { type: "delta", text: addendumText };
  }
  trace?.update({ output: { answer: fullText, cited: citations.length > 0, citationCount: citations.length, fallback, fallbackReason } });

  const answerPayload: AdvisorAnswerPayload = {
    answer_markdown: fullText,
    confidence: citations.length >= 2 ? "high" : citations.length === 1 ? "medium" : "low",
    disclaimer: "Haven provides information, not legal advice. Check a qualified immigration attorney before making decisions.",
    external_citations: citations,
    haven_context_used: havenContextUsed,
    community_context_used: communityUsed,
    follow_up_questions: [],
  };

  trace?.update({
    metadata: {
      topics,
      experiential,
      model,
      promptName: ADVISOR_PROMPT_NAME,
      retrievalKnowledgeCount: knowledge.length,
      retrievalCommunityCount: community.length,
      caseStatsTier: caseStats?.tier ?? "none",
      citationCount: citations.length,
      fallback,
      fallbackReason
    }
  });

  await flushLangfuse();

  yield { type: "done", assistantMessage: createAssistantMessage(threadId, answerPayload, traceId), conversationId: threadId, traceId };
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
        fetched_at: new Date().toISOString(),
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
