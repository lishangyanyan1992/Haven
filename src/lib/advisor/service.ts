import OpenAI from "openai";

import { env, hasSupabaseEnv } from "@/lib/env";
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
  KnowledgeChunk
} from "@/types/domain";
import {
  advisorAnswerJsonSchema,
  advisorAnswerPayloadSchema,
  advisorRespondSchema
} from "@/lib/advisor/schema";
import {
  buildFallbackCommunitySummaries,
  estimateTokenCount,
  getSourceHash,
  trustedKnowledgeDocuments,
  trustedKnowledgeSources
} from "@/lib/advisor/source-corpus";

type RetrievedKnowledgeChunk = KnowledgeChunk & { documentId?: string };
type RetrievedCommunitySummary = CommunityAdviceSummary;

type AdvisorIdentity = {
  id: string;
  email: string;
  fullName: string;
  isMock: boolean;
};

type TopicBucket = "h1b" | "visa-bulletin" | "perm" | "adjustment-of-status" | "job-change" | "layoffs" | "haven-product";

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
  if (/(i-485|adjustment of status|adjust status|ead)/.test(normalized)) topics.add("adjustment-of-status");
  if (/(job change|same or similar|ac21|portability)/.test(normalized)) topics.add("job-change");
  if (/(layoff|laid off|60-day|grace period)/.test(normalized)) topics.add("layoffs");
  if (/(haven|timeline|dashboard|planner|inbox|community)/.test(normalized)) topics.add("haven-product");

  return topics.size > 0 ? Array.from(topics) : ["h1b", "adjustment-of-status"];
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
      `Spouse visa status: ${profile.spouseVisaStatus}`,
      profile.currentVisaExpiryDate ? `Current visa expiry date: ${profile.currentVisaExpiryDate}` : "Current visa expiry date: not on file"
    ],
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

function buildSuggestedPrompts(snapshot: Awaited<ReturnType<typeof getSnapshot>>) {
  const [firstConcern] = snapshot.profile.topConcerns;
  return [
    `How does my ${snapshot.profile.preferenceCategory} + ${snapshot.profile.countryOfBirth} path affect what I should watch next?`,
    concernToPrompt(firstConcern ?? "layoffs", "What should I ask Haven first about my immigration timeline?"),
    snapshot.profile.priorityDate
      ? `What does the current visa bulletin mean for my ${snapshot.profile.preferenceCategory} priority date?`
      : "What information do you still need from me to answer green card timeline questions accurately?"
  ];
}

function createWelcomePayload(snapshot: Awaited<ReturnType<typeof getSnapshot>>): AdvisorAnswerPayload {
  return {
    answer_markdown: `I can help with work visa and green card questions using official immigration sources plus your Haven profile.\n\nStart with one of these:\n- ${buildSuggestedPrompts(snapshot).join("\n- ")}`,
    confidence: "medium",
    disclaimer: "Haven provides information, not legal advice. Check a qualified immigration attorney before making decisions.",
    external_citations: [],
    haven_context_used: ["Signed-in Haven profile available"],
    community_context_used: [],
    follow_up_questions: buildSuggestedPrompts(snapshot)
  };
}

function createAssistantMessage(threadId: string, payload: AdvisorAnswerPayload): AdvisorMessage {
  const createdAt = new Date().toISOString();
  return {
    id: `assistant-${createdAt}`,
    threadId,
    role: "assistant",
    content: payload.answer_markdown,
    createdAt,
    answerPayload: payload
  };
}

function buildContextBlock(label: string, lines: string[]) {
  return `${label}:\n${lines.length > 0 ? lines.map((line) => `- ${line}`).join("\n") : "- None"}`;
}

async function moderateMessage(content: string) {
  const client = getOpenAIClient();

  if (!client) {
    return { flagged: false };
  }

  try {
    const moderation = await client.moderations.create({
      model: "omni-moderation-latest",
      input: content
    });

    return {
      flagged: moderation.results?.[0]?.flagged ?? false
    };
  } catch {
    return { flagged: false };
  }
}

async function embedQuery(query: string) {
  const client = getOpenAIClient();

  if (!client) {
    return null;
  }

  const response = await client.embeddings.create({
    model: getEmbeddingModel(),
    input: query
  });

  return response.data[0]?.embedding ?? null;
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

async function retrieveKnowledge(query: string, topics: TopicBucket[]) {
  const chunks = buildFallbackKnowledgeChunks();

  const filtered = chunks.filter((chunk) => {
    if (topics.includes("haven-product")) return true;
    return topics.includes(chunk.topic as TopicBucket) || topics.some((topic) => chunk.content.toLowerCase().includes(topic));
  });

  return (filtered.length > 0 ? filtered : chunks)
    .map((chunk) => ({
      ...chunk,
      similarity: scoreOverlap(query, `${chunk.title} ${chunk.content} ${chunk.topic}`)
    }))
    .sort((left, right) => (right.similarity ?? 0) - (left.similarity ?? 0))
    .slice(0, 6);
}

async function retrieveCommunity(
  query: string,
  topics: TopicBucket[],
  snapshot: Awaited<ReturnType<typeof getSnapshot>>
) {
  if (!topics.some((topic) => topic === "layoffs" || topic === "job-change")) {
    return [] as RetrievedCommunitySummary[];
  }

  return [...buildSnapshotCommunitySummaries(snapshot), ...buildFallbackCommunitySummaries()]
    .map((item) => ({
      ...item,
      similarity: scoreOverlap(query, `${item.title} ${item.summary} ${item.topic}`)
    }))
    .sort((left, right) => (right.similarity ?? 0) - (left.similarity ?? 0))
    .slice(0, 3);
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
    userContext.profileSummary[0],
    userContext.profileSummary[1],
    userContext.profileSummary[3],
    userContext.derivedSignalsSummary[1]
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

async function generateAdvisorAnswer(input: {
  question: string;
  userContext: AdvisorUserContext;
  knowledge: RetrievedKnowledgeChunk[];
  community: RetrievedCommunitySummary[];
  history: AdvisorMessage[];
  topics: TopicBucket[];
}): Promise<AdvisorAnswerPayload> {
  const client = getOpenAIClient();

  if (!client) {
    return fallbackAnswer(input.question, input.userContext, input.knowledge, input.community, input.topics);
  }

  const systemPrompt = [
    "You are Haven Advisor, an immigration information assistant for employment-based visas and green cards.",
    "You must prioritize official sources over Haven context, and Haven context over community anecdotes.",
    "Never present community anecdotes as legal authority.",
    "Never invent eligibility, filing windows, dates, or conclusions.",
    "If the question is risky, uncertain, or too case-specific, answer with general guidance and recommend attorney review.",
    "Every substantive answer must include official citations in external_citations.",
    "Only answer work visa, green card, or Haven product questions. Refuse unrelated topics."
  ].join(" ");

  const prompt = [
    `User question:\n${input.question}`,
    "",
    buildContextBlock("Haven profile summary", input.userContext.profileSummary),
    "",
    buildContextBlock("Haven timeline summary", input.userContext.timelineSummary),
    "",
    buildContextBlock("Haven derived signals", input.userContext.derivedSignalsSummary),
    "",
    buildContextBlock("Haven email evidence", input.userContext.emailEvidenceSummary),
    "",
    buildContextBlock(
      "Official source chunks",
      input.knowledge.map((item) => `${item.agency} | ${item.title} | ${item.url} | ${item.content}`)
    ),
    "",
    buildContextBlock(
      "Community summaries",
      input.community.map((item) => `${item.title} | ${item.summary} | Caveat: ${item.legalCaveat}`)
    ),
    "",
    buildContextBlock(
      "Recent conversation",
      input.history.slice(-6).map((message) => `${message.role.toUpperCase()} @ ${formatTimestamp(message.createdAt)}: ${message.content}`)
    )
  ].join("\n");

  try {
    const response = await client.responses.create({
      model: getChatModel(),
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          ...advisorAnswerJsonSchema
        }
      }
    } as never);

    const parsed = advisorAnswerPayloadSchema.safeParse(JSON.parse(response.output_text ?? "{}"));
    if (parsed.success && parsed.data.external_citations.length > 0) {
      return parsed.data;
    }
  } catch {
    // Fall back to deterministic answer below.
  }

  return fallbackAnswer(input.question, input.userContext, input.knowledge, input.community, input.topics);
}

export async function getAdvisorWorkspaceSeed() {
  const snapshot = await getSnapshot();

  return {
    suggestedPrompts: buildSuggestedPrompts(snapshot),
    welcomeMessage: createWelcomePayload(snapshot)
  };
}

export async function respondToAdvisorMessage(rawInput: {
  content: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}) {
  await getAdvisorIdentity();
  const parsed = advisorRespondSchema.safeParse(rawInput);

  if (!parsed.success) {
    throw new Error("Message content is required.");
  }

  const { content, history: rawHistory } = parsed.data;

  const moderation = await moderateMessage(content);
  const snapshot = await getSnapshot();

  if (moderation.flagged) {
    const flaggedAnswer: AdvisorAnswerPayload = {
      answer_markdown:
        "I can help with work visa and green card questions, but I can’t continue with this message as written. Rephrase it as a factual immigration or Haven-product question and I’ll answer from official sources.",
      confidence: "low",
      disclaimer: "Haven provides information, not legal advice. Check a qualified immigration attorney before making decisions.",
      external_citations: [],
      haven_context_used: [],
      community_context_used: [],
      follow_up_questions: [
        "Do you want to ask about H-1B, PERM, I-140, I-485, or the visa bulletin instead?",
        "Do you want me to use your Haven profile to focus the answer?"
      ],
      refusal_or_escalation_reason: "Message flagged by moderation."
    };

    return {
      userMessage: null,
      assistantMessage: createAssistantMessage("session", flaggedAnswer)
    };
  }

  const userMessage: AdvisorMessage = {
    id: `user-${Date.now()}`,
    threadId: "session",
    role: "user",
    content,
    createdAt: new Date().toISOString()
  };
  const history: AdvisorMessage[] = rawHistory.map((message, index) => ({
    id: `history-${index}`,
    threadId: "session",
    role: message.role,
    content: message.content,
    createdAt: new Date(Date.now() - (rawHistory.length - index) * 1000).toISOString()
  }));

  const topics = classifyTopics(content);
  const userContext = buildAdvisorContext(snapshot);
  const knowledge = await retrieveKnowledge(content, topics);
  const community = await retrieveCommunity(content, topics, snapshot);
  const answer = await generateAdvisorAnswer({
    question: content,
    userContext,
    knowledge,
    community,
    history,
    topics
  });
  const assistantMessage = createAssistantMessage("session", answer);

  return {
    userMessage,
    assistantMessage
  };
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
