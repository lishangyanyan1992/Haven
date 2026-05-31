import crypto from "node:crypto";

import type { Langfuse } from "langfuse";

import { env } from "@/lib/env";
import { getStoryLangfuseClient } from "@/lib/langfuse";
import type { Json } from "@/types/database";

type StoryTraceContext = {
  importItemId?: string | null;
  runId?: string | null;
  source?: string | null;
  sourceStoryId?: string | null;
  traceId?: string | null;
};

type StoryEventInput = StoryTraceContext & {
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  name: string;
  output?: Record<string, unknown>;
};

type StorySourceSummary = {
  authorKnown: boolean;
  bodyHash: string | null;
  bodyLength: number;
  commentCount: number;
  commentHashes: string[];
  commentLengths: number[];
  sourceDomain: string | null;
  sourceUrl: string | null;
  titleHash: string | null;
  titleLength: number;
};

export type AutoReviewScorePayload = {
  approve: boolean;
  comments_not_too_similar: boolean;
  comments_preserve_key_info: boolean;
  confidence: "high" | "medium" | "low";
  issues: string[];
  post_not_too_similar: boolean;
  post_preserve_key_info: boolean;
  summary: string;
};

function readObject(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stableHash(value: string) {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readComments(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];

  return value
    .map((comment) => {
      if (typeof comment === "string") return comment.trim();
      const record = readObject(comment);
      return readString(record.body_translated) || readString(record.body);
    })
    .filter(Boolean);
}

function getSourceDomain(sourceUrl: string) {
  if (!sourceUrl) return null;

  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return null;
  }
}

function getConfidenceScore(confidence: AutoReviewScorePayload["confidence"]) {
  switch (confidence) {
    case "high":
      return 1;
    case "medium":
      return 0.5;
    default:
      return 0;
  }
}

function getClient(): Langfuse | null {
  return getStoryLangfuseClient();
}

export function createStoryTraceId() {
  return crypto.randomUUID();
}

export function hashReviewerId(userId: string) {
  return stableHash(userId);
}

export function getStoryTraceUrl(traceId: string | null | undefined) {
  if (!traceId) return null;
  const baseUrl = (env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com").replace(/\/$/, "");
  return `${baseUrl}/trace/${encodeURIComponent(traceId)}`;
}

export function summarizeStorySource(sourcePayloadPrivate: Json | undefined): StorySourceSummary {
  const source = readObject(sourcePayloadPrivate);
  const title = readString(source.title);
  const body = readString(source.body);
  const sourceUrl = readString(source.source_url);
  const authorName = readString(source.author_name).toLowerCase();
  const comments = readComments(source.comments);

  return {
    authorKnown: Boolean(authorName && !["[deleted]", "deleted", "anonymous", "unknown", "reddit user", "community member", "member", "user"].includes(authorName)),
    bodyHash: stableHash(body),
    bodyLength: body.length,
    commentCount: comments.length,
    commentHashes: comments.map((comment) => stableHash(comment)).filter((hash): hash is string => Boolean(hash)),
    commentLengths: comments.map((comment) => comment.length),
    sourceDomain: getSourceDomain(sourceUrl),
    sourceUrl: sourceUrl || null,
    titleHash: stableHash(title),
    titleLength: title.length
  };
}

export function buildStoryObservabilityMetadata(params: StoryTraceContext & {
  language?: string | null;
  moderationStatus?: string | null;
  publishReady?: boolean | null;
  publishedPostId?: string | null;
  sourcePayloadPrivate?: Json;
  tags?: string[];
}) {
  return {
    import_item_id: params.importItemId ?? null,
    language: params.language ?? null,
    moderation_status: params.moderationStatus ?? null,
    publish_ready: params.publishReady ?? null,
    published_post_id: params.publishedPostId ?? null,
    run_id: params.runId ?? null,
    source: params.source ?? null,
    source_story_id: params.sourceStoryId ?? null,
    tags: params.tags ?? [],
    trace_id: params.traceId ?? null,
    source_summary: summarizeStorySource(params.sourcePayloadPrivate)
  };
}

export function startStoryTrace(params: StoryTraceContext & {
  input?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  name: string;
  tags?: string[];
}) {
  const client = getClient();
  if (!client || !params.traceId) return null;

  return client.trace({
    id: params.traceId,
    input: params.input,
    metadata: {
      importItemId: params.importItemId ?? undefined,
      runId: params.runId ?? undefined,
      source: params.source ?? undefined,
      sourceStoryId: params.sourceStoryId ?? undefined,
      ...params.metadata
    },
    name: params.name,
    sessionId: params.runId ?? undefined,
    tags: params.tags
  });
}

export function trackStoryEvent(params: StoryEventInput) {
  const trace = startStoryTrace({
    importItemId: params.importItemId,
    input: params.input,
    metadata: params.metadata,
    name: "story-pipeline",
    runId: params.runId,
    source: params.source,
    sourceStoryId: params.sourceStoryId,
    tags: ["story-pipeline", params.source ?? "unknown-source"],
    traceId: params.traceId
  });

  try {
    const event = (trace as any)?.event;
    if (typeof event === "function") {
      event.call(trace, {
        input: params.input,
        metadata: params.metadata,
        name: params.name,
        output: params.output
      });
      return;
    }

    const span = trace?.span({
      input: params.input,
      metadata: params.metadata,
      name: params.name
    });
    span?.end({ output: params.output });
  } catch {
    // Observability must never break the pipeline.
  }
}

export function scoreStoryTrace(params: StoryTraceContext & {
  comment?: string;
  dataType: "BOOLEAN" | "NUMERIC";
  name: string;
  value: number;
}) {
  const client = getClient();
  if (!client || !params.traceId) return;

  try {
    client.score({
      comment: params.comment,
      dataType: params.dataType,
      name: params.name,
      traceId: params.traceId,
      value: params.value
    });
  } catch {
    // Observability must never break the pipeline.
  }
}

export function scoreAutoReview(params: StoryTraceContext & {
  verdict: AutoReviewScorePayload;
}) {
  const { verdict } = params;
  const comment = verdict.issues.length > 0 ? verdict.issues.join(" | ") : verdict.summary;

  scoreStoryTrace({ ...params, comment, dataType: "BOOLEAN", name: "auto_review_approved", value: verdict.approve ? 1 : 0 });
  scoreStoryTrace({ ...params, comment, dataType: "BOOLEAN", name: "post_preserved_key_info", value: verdict.post_preserve_key_info ? 1 : 0 });
  scoreStoryTrace({ ...params, comment, dataType: "BOOLEAN", name: "post_not_too_similar", value: verdict.post_not_too_similar ? 1 : 0 });
  scoreStoryTrace({ ...params, comment, dataType: "BOOLEAN", name: "comments_preserved_key_info", value: verdict.comments_preserve_key_info ? 1 : 0 });
  scoreStoryTrace({ ...params, comment, dataType: "BOOLEAN", name: "comments_not_too_similar", value: verdict.comments_not_too_similar ? 1 : 0 });
  scoreStoryTrace({ ...params, comment: verdict.confidence, dataType: "NUMERIC", name: "auto_review_confidence", value: getConfidenceScore(verdict.confidence) });
}
