"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";

import { buildAnonymousCommentAuthor, readPublishDraft } from "@/lib/community-imports";
import { env } from "@/lib/env";
import { flushLangfuse, getPrompt, getStoryLangfuseClient } from "@/lib/langfuse";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildStoryObservabilityMetadata,
  hashReviewerId,
  scoreAutoReview,
  scoreStoryTrace,
  trackStoryEvent
} from "@/lib/story-observability";
import type { Json } from "@/types/database";

export type ReviewCommunityImportActionState = {
  message: string;
  status: "idle" | "success" | "error";
};

type AutoReviewVerdict = {
  approve: boolean;
  comments_not_too_similar: boolean;
  comments_preserve_key_info: boolean;
  confidence: "high" | "medium" | "low";
  issues: string[];
  post_not_too_similar: boolean;
  post_preserve_key_info: boolean;
  summary: string;
};

function isMissingCommunityPostCommentsTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) {
    return false;
  }

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message?.includes("community_post_comments") === true ||
    error.message?.includes("schema cache") === true
  );
}

function readObject(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCommentBody(body: string) {
  return body
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizePostBody(body: string) {
  return body
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractProvidedCommentBodies(rawPublishDraft: unknown) {
  const draft = readObject(rawPublishDraft);
  const comments = Array.isArray(draft.comments) ? draft.comments : [];

  return comments
    .map((comment) => {
      if (typeof comment === "string") {
        return readString(comment);
      }

      if (typeof comment !== "object" || comment === null) {
        return "";
      }

      return readString((comment as Record<string, unknown>).body);
    })
    .filter(Boolean)
    .map(normalizeCommentBody);
}

function extractSourceCommentBodies(rawSourcePayloadPrivate: unknown) {
  const source = readObject(rawSourcePayloadPrivate);
  const comments = Array.isArray(source.comments) ? source.comments : [];

  return comments
    .map((comment) => {
      if (typeof comment !== "object" || comment === null) {
        return "";
      }

      const record = comment as Record<string, unknown>;
      return readString(record.body_translated) || readString(record.body);
    })
    .filter(Boolean)
    .map(normalizeCommentBody);
}

function getOpenAIClient() {
  if (!env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

function getChatModel() {
  return env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
}

const COMMUNITY_COMMENT_REWRITE_FALLBACK = "You rewrite forum comments into concise paraphrases.";
const COMMUNITY_POST_REWRITE_FALLBACK = "You rewrite forum posts into less identifiable public summaries while preserving the same meaning.";
const COMMUNITY_AUTO_REVIEW_FALLBACK = "You are a strict QA reviewer for anonymized forum rewrites.";

function summarizeList(items: string[]) {
  return items.filter(Boolean).join(" | ");
}

async function rewriteCommentBodiesWithAI(
  commentBodies: string[],
  traceContext?: {
    importItemId?: string | null;
    source?: string | null;
    sourceStoryId?: string | null;
    traceId?: string | null;
  }
) {
  const client = getOpenAIClient();

  if (!client || commentBodies.length === 0) {
    return commentBodies;
  }

  const lf = getStoryLangfuseClient();
  const model = getChatModel();
  const { text: systemPrompt, prompt: lfPrompt } = await getPrompt(lf, "haven-community-comment-rewrite", COMMUNITY_COMMENT_REWRITE_FALLBACK);

  const prompt = [
    "Rewrite each community comment so it keeps the same meaning and practical advice but does not copy the original wording.",
    "Requirements:",
    "- Keep the same number of comments and the same order.",
    "- Use 1 to 3 concise sentences per comment.",
    "- Keep key immigration facts, cautions, and advice.",
    "- Remove usernames, links, markdown, bullets, strike-throughs, and edit notes.",
    "- Do not quote the original wording.",
    "- Use calm, practical forum language.",
    "",
    JSON.stringify({ comments: commentBodies })
  ].join("\n");

  const trace = lf?.trace({
    id: traceContext?.traceId ?? undefined,
    input: {
      comment_count: commentBodies.length,
      comment_lengths: commentBodies.map((body) => body.length)
    },
    metadata: {
      importItemId: traceContext?.importItemId ?? undefined,
      source: traceContext?.source ?? undefined,
      sourceStoryId: traceContext?.sourceStoryId ?? undefined
    },
    name: "community-comment-rewrite",
    tags: ["story-pipeline", traceContext?.source ?? "unknown-source"]
  });
  const generation = trace?.generation({
    name: "openai-comment-rewrite",
    model,
    prompt: lfPrompt,
    input: {
      comment_count: commentBodies.length,
      comment_lengths: commentBodies.map((body) => body.length)
    },
  });

  try {
    const response = await (client.responses.create as Function)({
      model,
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
          name: "community_comment_rewrites",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["comments"],
            properties: {
              comments: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["body"],
                  properties: {
                    body: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    });

    const parsed = JSON.parse((response as { output_text?: string }).output_text ?? "{}") as {
      comments?: Array<{ body?: string }>;
    };

    const rewritten = Array.isArray(parsed.comments)
      ? parsed.comments.map((comment) => normalizeCommentBody(readString(comment.body))).filter(Boolean)
      : [];

    if (rewritten.length === commentBodies.length) {
      generation?.end({ output: { count: rewritten.length } });
      await flushLangfuse();
      return rewritten;
    }
    generation?.end({ output: { fallback: true, reason: "count mismatch" } });
  } catch (err) {
    generation?.end({ output: { error: String(err) }, level: "ERROR" });
  }

  await flushLangfuse();
  return commentBodies;
}

function fallbackAutoReviewVerdict(params: {
  publishedBody: string;
  publishedComments: string[];
  sourceBody: string;
  sourceComments: string[];
}) {
  const normalizedSourceBody = normalizePostBody(params.sourceBody).toLowerCase();
  const normalizedPublishedBody = normalizePostBody(params.publishedBody).toLowerCase();
  const sourceCommentBlob = params.sourceComments.map((comment) => normalizeCommentBody(comment).toLowerCase()).join("\n");
  const publishedCommentBlob = params.publishedComments.map((comment) => normalizeCommentBody(comment).toLowerCase()).join("\n");

  const postNotTooSimilar = normalizedSourceBody !== normalizedPublishedBody;
  const commentsNotTooSimilar =
    params.sourceComments.length === 0 ||
    sourceCommentBlob !== publishedCommentBlob;

  return {
    approve: postNotTooSimilar && commentsNotTooSimilar,
    comments_not_too_similar: commentsNotTooSimilar,
    comments_preserve_key_info: params.sourceComments.length === 0 || params.publishedComments.length > 0,
    confidence: "low" as const,
    issues: [
      ...(!postNotTooSimilar ? ["Post body is too close to the source wording."] : []),
      ...(!commentsNotTooSimilar ? ["Comments are too close to the source wording."] : [])
    ],
    post_not_too_similar: postNotTooSimilar,
    post_preserve_key_info: Boolean(params.publishedBody.trim()),
    summary: postNotTooSimilar && commentsNotTooSimilar
      ? "Fallback review passed basic non-copy checks."
      : "Fallback review found content that is still too close to the source."
  };
}

function buildFallbackForumTitle(title: string) {
  return readString(title)
    .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\b/gi, "")
    .replace(/\b\d{4}\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+[-,:;]\s*$/g, "")
    .trim();
}

function buildFallbackForumBody(body: string) {
  return normalizePostBody(
    body
      .replace(/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\b/gi, "recently")
      .replace(/\b\d{4}\b/g, "recent")
      .replace(/\b\d{1,2}-day\b/gi, "limited")
      .replace(/\b\d{1,2}\s+days?\b/gi, "a short window")
      .replace(/\b\d+\s+months?\b/gi, "quite a while")
  );
}

async function rewriteForumPostWithAI(params: {
  sourceBody: string;
  sourceTitle: string;
  draftBody: string;
  draftTitle: string;
  traceContext?: {
    importItemId?: string | null;
    source?: string | null;
    sourceStoryId?: string | null;
    traceId?: string | null;
  };
}) {
  const client = getOpenAIClient();
  const fallback = {
    title: buildFallbackForumTitle(params.draftTitle) || params.draftTitle,
    body: buildFallbackForumBody(params.draftBody) || params.draftBody
  };

  if (!client) {
    return fallback;
  }

  const lf = getStoryLangfuseClient();
  const model = getChatModel();
  const { text: systemPrompt, prompt: lfPrompt } = await getPrompt(lf, "haven-community-post-rewrite", COMMUNITY_POST_REWRITE_FALLBACK);

  const prompt = [
    "Rewrite this forum post so it is meaningfully less identifiable than the original source while preserving the same first-person situation and the main questions.",
    "Requirements:",
    "- Keep first-person voice.",
    "- Do not copy the original phrasing.",
    "- Generalize exact dates, month names, exact timelines, and other distinctive specifics.",
    "- Keep the important immigration facts and the core ask.",
    "- Do not mention usernames, company-specific context, or any platform details.",
    "- Make the title and body read naturally for a public forum.",
    "- Keep the body concise but complete.",
    "",
    JSON.stringify({
      source_title: params.sourceTitle,
      source_body: params.sourceBody,
      current_forum_title: params.draftTitle,
      current_forum_body: params.draftBody
    })
  ].join("\n");

  const trace = lf?.trace({
    id: params.traceContext?.traceId ?? undefined,
    input: {
      draft_body_length: params.draftBody.length,
      source_body_length: params.sourceBody.length,
      source_title_hash_available: Boolean(params.sourceTitle)
    },
    metadata: {
      importItemId: params.traceContext?.importItemId ?? undefined,
      source: params.traceContext?.source ?? undefined,
      sourceStoryId: params.traceContext?.sourceStoryId ?? undefined
    },
    name: "community-post-rewrite",
    tags: ["story-pipeline", params.traceContext?.source ?? "unknown-source"]
  });
  const generation = trace?.generation({
    name: "openai-post-rewrite",
    model,
    prompt: lfPrompt,
    input: {
      current_forum_body_length: params.draftBody.length,
      current_forum_title_length: params.draftTitle.length,
      source_body_length: params.sourceBody.length,
      source_title_length: params.sourceTitle.length
    },
  });

  try {
    const response = await (client.responses.create as Function)({
      model,
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
          name: "community_post_rewrite",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "body"],
            properties: {
              title: { type: "string" },
              body: { type: "string" }
            }
          }
        }
      }
    });

    const parsed = JSON.parse((response as { output_text?: string }).output_text ?? "{}") as {
      title?: string;
      body?: string;
    };

    const title = readString(parsed.title);
    const body = normalizePostBody(readString(parsed.body));

    if (title && body) {
      generation?.end({ output: { title: title.slice(0, 80) } });
      await flushLangfuse();
      return { title, body };
    }
    generation?.end({ output: { fallback: true, reason: "empty title or body" } });
  } catch (err) {
    generation?.end({ output: { error: String(err) }, level: "ERROR" });
  }

  await flushLangfuse();
  return fallback;
}

async function buildPublishedComments(params: {
  rawPublishDraft: unknown;
  rawSourcePayloadPrivate: unknown;
  parsedDraft: ReturnType<typeof readPublishDraft>;
  traceContext?: {
    importItemId?: string | null;
    source?: string | null;
    sourceStoryId?: string | null;
    traceId?: string | null;
  };
}) {
  const providedCommentBodies = extractProvidedCommentBodies(params.rawPublishDraft);

  if (providedCommentBodies.length > 0) {
    return providedCommentBodies.map((body, index) => ({
      authorLabel: params.parsedDraft.comments[index]?.authorLabel ?? buildAnonymousCommentAuthor(index),
      authorKey: params.parsedDraft.comments[index]?.authorKey ?? `import:synthetic:comment-${index + 1}`,
      body
    }));
  }

  const sourceCommentBodies = params.parsedDraft.comments.map((comment) => normalizeCommentBody(comment.body));
  const rewrittenSourceCommentBodies = await rewriteCommentBodiesWithAI(sourceCommentBodies, params.traceContext);

  return rewrittenSourceCommentBodies.map((body, index) => ({
    authorLabel: params.parsedDraft.comments[index]?.authorLabel ?? buildAnonymousCommentAuthor(index),
    authorKey: params.parsedDraft.comments[index]?.authorKey ?? `import:synthetic:comment-${index + 1}`,
    body
  }));
}

async function buildPublishedPostDraft(params: {
  rawPublishDraft: unknown;
  rawSourcePayloadPrivate: unknown;
  parsedDraft: ReturnType<typeof readPublishDraft>;
  traceContext?: {
    importItemId?: string | null;
    source?: string | null;
    sourceStoryId?: string | null;
    traceId?: string | null;
  };
}) {
  const source = readObject(params.rawSourcePayloadPrivate);
  const sourceTitle = readString(source.title);
  const sourceBody = normalizePostBody(readString(source.body));

  const rewritten = await rewriteForumPostWithAI({
    sourceBody,
    sourceTitle,
    draftBody: params.parsedDraft.body,
    draftTitle: params.parsedDraft.title,
    traceContext: params.traceContext
  });

  return {
    ...params.parsedDraft,
    title: rewritten.title,
    body: rewritten.body
  };
}

async function evaluatePreparedCommunityImport(params: {
  publishedComments: Array<{ authorLabel: string; body: string }>;
  publishedDraft: Awaited<ReturnType<typeof buildPublishedPostDraft>>;
  rawSourcePayloadPrivate: unknown;
  traceContext?: {
    importItemId?: string | null;
    source?: string | null;
    sourceStoryId?: string | null;
    traceId?: string | null;
  };
}) {
  const source = readObject(params.rawSourcePayloadPrivate);
  const sourceTitle = readString(source.title);
  const sourceBody = normalizePostBody(readString(source.body));
  const sourceComments = extractSourceCommentBodies(params.rawSourcePayloadPrivate);
  const publishedComments = params.publishedComments.map((comment) => normalizeCommentBody(comment.body));
  const client = getOpenAIClient();

  if (!client) {
    return fallbackAutoReviewVerdict({
      publishedBody: params.publishedDraft.body,
      publishedComments,
      sourceBody,
      sourceComments
    });
  }

  const lf = getStoryLangfuseClient();
  const model = getChatModel();
  const { text: systemPrompt, prompt: lfPrompt } = await getPrompt(lf, "haven-community-auto-review", COMMUNITY_AUTO_REVIEW_FALLBACK);

  const prompt = [
    "Review whether this rewritten community post and its rewritten comments are safe to auto-publish.",
    "Approve only if:",
    "- the rewritten post keeps the key immigration facts, constraints, and questions from the source",
    "- the rewritten comments keep the useful practical advice from the source comments",
    "- neither the post nor the comments read like copies of the original wording",
    "",
    "Reject if important facts/questions are missing, meaning changes materially, or the rewrite is still too close to the source.",
    "",
    JSON.stringify({
      source_title: sourceTitle,
      source_body: sourceBody,
      source_comments: sourceComments,
      candidate_title: params.publishedDraft.title,
      candidate_body: params.publishedDraft.body,
      candidate_comments: publishedComments
    })
  ].join("\n");

  const trace = lf?.trace({
    id: params.traceContext?.traceId ?? undefined,
    input: {
      candidate_body_length: params.publishedDraft.body.length,
      candidate_comment_count: publishedComments.length,
      source_body_length: sourceBody.length,
      source_comment_count: sourceComments.length
    },
    metadata: {
      importItemId: params.traceContext?.importItemId ?? undefined,
      source: params.traceContext?.source ?? undefined,
      sourceStoryId: params.traceContext?.sourceStoryId ?? undefined
    },
    name: "community-auto-review",
    tags: ["story-pipeline", params.traceContext?.source ?? "unknown-source"]
  });
  const generation = trace?.generation({
    name: "openai-auto-review",
    model,
    prompt: lfPrompt,
    input: {
      candidate_body_length: params.publishedDraft.body.length,
      candidate_comment_count: publishedComments.length,
      source_body_length: sourceBody.length,
      source_comment_count: sourceComments.length
    },
  });

  try {
    const response = await (client.responses.create as Function)({
      model,
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
          name: "community_import_auto_review",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "approve",
              "comments_not_too_similar",
              "comments_preserve_key_info",
              "confidence",
              "issues",
              "post_not_too_similar",
              "post_preserve_key_info",
              "summary"
            ],
            properties: {
              approve: { type: "boolean" },
              comments_not_too_similar: { type: "boolean" },
              comments_preserve_key_info: { type: "boolean" },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              issues: {
                type: "array",
                items: { type: "string" }
              },
              post_not_too_similar: { type: "boolean" },
              post_preserve_key_info: { type: "boolean" },
              summary: { type: "string" }
            }
          }
        }
      }
    });

    const parsed = JSON.parse((response as { output_text?: string }).output_text ?? "{}") as AutoReviewVerdict;

    if (typeof parsed.approve === "boolean" && typeof parsed.summary === "string") {
      const result = {
        ...parsed,
        issues: Array.isArray(parsed.issues) ? parsed.issues.filter((issue) => typeof issue === "string" && issue.trim().length > 0) : []
      };
      generation?.end({ output: { approve: result.approve, confidence: result.confidence } });
      scoreAutoReview({
        importItemId: params.traceContext?.importItemId,
        source: params.traceContext?.source,
        sourceStoryId: params.traceContext?.sourceStoryId,
        traceId: params.traceContext?.traceId,
        verdict: result
      });
      await flushLangfuse();
      return result;
    }
    generation?.end({ output: { fallback: true, reason: "invalid response shape" } });
  } catch (err) {
    generation?.end({ output: { error: String(err) }, level: "ERROR" });
  }

  await flushLangfuse();
  const fallback = fallbackAutoReviewVerdict({
    publishedBody: params.publishedDraft.body,
    publishedComments,
    sourceBody,
    sourceComments
  });
  scoreAutoReview({
    importItemId: params.traceContext?.importItemId,
    source: params.traceContext?.source,
    sourceStoryId: params.traceContext?.sourceStoryId,
    traceId: params.traceContext?.traceId,
    verdict: fallback
  });
  return fallback;
}

function formatAutoReviewNotes(result: AutoReviewVerdict, prefix: string) {
  const issueLine = result.issues.length > 0 ? ` Issues: ${summarizeList(result.issues)}` : "";
  return `${prefix} ${result.summary} Confidence: ${result.confidence}.${issueLine}`.trim();
}

function getAllowedReviewerEmails() {
  return new Set(
    (env.COMMUNITY_IMPORT_REVIEWER_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function hasReviewerAccess(email: string) {
  const allowedEmails = getAllowedReviewerEmails();
  return allowedEmails.size > 0 && allowedEmails.has(email);
}

async function requireReviewer() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  const email = user.email?.toLowerCase() ?? "";

  if (!hasReviewerAccess(email)) {
    throw new Error("Reviewer access required.");
  }

  return user;
}

async function getDefaultCommunitySpaceId(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const defaultForumName = "Community Forum";
  const defaultForumSummary = "Main forum for moderated community posts.";

  const { data: existingDefaultSpace, error: existingDefaultSpaceError } = await admin
    .from("community_spaces")
    .select("id")
    .eq("space_type", "cohort")
    .eq("name", defaultForumName)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingDefaultSpaceError) {
    throw new Error(existingDefaultSpaceError.message);
  }

  if (existingDefaultSpace) {
    return existingDefaultSpace.id;
  }

  const { data: createdSpace, error: createSpaceError } = await admin
    .from("community_spaces")
    .insert({
      name: defaultForumName,
      space_type: "cohort",
      summary: defaultForumSummary
    })
    .select("id")
    .single();

  if (createSpaceError || !createdSpace) {
    throw new Error(createSpaceError?.message ?? "Unable to create default community forum.");
  }

  return createdSpace.id;
}

async function ensureCommunityAuthor(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  authorKey?: string;
  authorLabel: string;
  linkedUserId?: string | null;
  source?: string;
}) {
  const { admin, authorKey, authorLabel, linkedUserId, source } = params;

  if (linkedUserId) {
    const { data: existingLinkedAuthor, error: linkedLookupError } = await admin
      .from("community_authors")
      .select("id, author_label")
      .eq("linked_user_id", linkedUserId)
      .maybeSingle();

    if (linkedLookupError) {
      throw new Error(linkedLookupError.message);
    }

    if (existingLinkedAuthor) {
      if (existingLinkedAuthor.author_label !== authorLabel) {
        const { error: updateLinkedError } = await admin
          .from("community_authors")
          .update({ author_label: authorLabel })
          .eq("id", existingLinkedAuthor.id);

        if (updateLinkedError) {
          throw new Error(updateLinkedError.message);
        }
      }

      return {
        id: existingLinkedAuthor.id,
        authorLabel
      };
    }

    const { data: insertedLinkedAuthor, error: insertLinkedError } = await admin
      .from("community_authors")
      .insert({
        linked_user_id: linkedUserId,
        author_label: authorLabel
      })
      .select("id, author_label")
      .single();

    if (insertLinkedError || !insertedLinkedAuthor) {
      throw new Error(insertLinkedError?.message ?? "Unable to create linked community author.");
    }

    return {
      id: insertedLinkedAuthor.id,
      authorLabel: insertedLinkedAuthor.author_label
    };
  }

  if (!source || !authorKey) {
    return {
      id: null,
      authorLabel
    };
  }

  const { data: existingImportedAuthor, error: importedLookupError } = await admin
    .from("community_authors")
    .select("id, author_label")
    .eq("source", source)
    .eq("external_author_key", authorKey)
    .maybeSingle();

  if (importedLookupError) {
    throw new Error(importedLookupError.message);
  }

  if (existingImportedAuthor) {
    return {
      id: existingImportedAuthor.id,
      authorLabel: existingImportedAuthor.author_label
    };
  }

  const { data: insertedImportedAuthor, error: insertImportedError } = await admin
    .from("community_authors")
    .insert({
      source,
      external_author_key: authorKey
    })
    .select("id, author_label")
    .single();

  if (insertImportedError || !insertedImportedAuthor) {
    throw new Error(insertImportedError?.message ?? "Unable to create imported community author.");
  }

  return {
    id: insertedImportedAuthor.id,
    authorLabel: insertedImportedAuthor.author_label
  };
}

export async function reviewCommunityImportAction(
  _previousState: ReviewCommunityImportActionState,
  formData: FormData
): Promise<ReviewCommunityImportActionState> {
  const itemId = String(formData.get("itemId") ?? "").trim();
  const intent = String(formData.get("intent") ?? "").trim();
  const moderationNotes = String(formData.get("moderationNotes") ?? "").trim();

  try {
    return await runReviewCommunityImportAction({ itemId, intent, moderationNotes });
  } catch (error) {
    return {
      status: "error" as const,
      message: error instanceof Error ? error.message : "Unable to process this review action."
    };
  }
}

async function syncImportedComments(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  itemId: string;
  postId: string;
  comments: Array<{ authorKey: string; authorLabel: string; body: string }>;
  source: string;
}) {
  const { admin, comments, itemId, postId, source } = params;

  const { error: deleteCommentsError } = await admin
    .from("community_post_comments")
    .delete()
    .eq("post_id", postId)
    .eq("import_item_id", itemId);

  if (deleteCommentsError) {
    if (isMissingCommunityPostCommentsTable(deleteCommentsError)) {
      return "Post published, but imported comments were skipped because the comments table is not migrated yet.";
    }
    throw new Error(deleteCommentsError.message);
  }

  if (comments.length === 0) {
    return "";
  }

  const authorCache = new Map<string, Awaited<ReturnType<typeof ensureCommunityAuthor>>>();
  const { error: insertCommentsError } = await admin.from("community_post_comments").insert(
    await Promise.all(comments.map(async (comment, index) => {
      const cacheKey = `${source}:${comment.authorKey}`;
      let author = authorCache.get(cacheKey);
      if (!author) {
        author = await ensureCommunityAuthor({
          admin,
          authorKey: comment.authorKey,
          authorLabel: comment.authorLabel,
          source
        });
        authorCache.set(cacheKey, author);
      }

      return {
        post_id: postId,
        import_item_id: itemId,
        user_id: null,
        author_id: author.id,
        author_label: author.authorLabel,
        body: comment.body,
        sort_order: index
      };
    }))
  );

  if (insertCommentsError) {
    if (isMissingCommunityPostCommentsTable(insertCommentsError)) {
      return "Post published, but imported comments were skipped because the comments table is not migrated yet.";
    }
    throw new Error(insertCommentsError.message);
  }

  return "";
}

async function publishCommunityImportItem(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  draft: Awaited<ReturnType<typeof buildPublishedPostDraft>>;
  item: {
    id: string;
    langfuse_trace_id: string | null;
    published_post_id: string | null;
    source: string;
    source_payload_private: unknown;
    source_story_id: string;
  };
  moderationNotes: string;
  publishedComments: Array<{ authorKey: string; authorLabel: string; body: string }>;
  userId: string;
}) {
  const { admin, draft, item, moderationNotes, publishedComments, userId } = params;
  const communitySpaceId = await getDefaultCommunitySpaceId(admin);
  const publishedPostId = await resolvePublishedPostId({
    admin,
    communitySpaceId,
    draft,
    importItemId: item.id,
    publishedPostId: item.published_post_id,
    source: item.source
  });

  if (!publishedPostId) {
    throw new Error("Unable to resolve published post id.");
  }

  const commentWarning = await syncImportedComments({
    admin,
    comments: publishedComments,
    itemId: item.id,
    postId: publishedPostId,
    source: item.source
  });

  const { error } = await admin
    .from("community_import_items")
    .update({
      moderation_status: "approved",
      moderation_notes: moderationNotes || null,
      observability_metadata: buildStoryObservabilityMetadata({
        importItemId: item.id,
        moderationStatus: "approved",
        publishedPostId,
        runId: null,
        source: item.source,
        sourcePayloadPrivate: item.source_payload_private as Json,
        sourceStoryId: item.source_story_id,
        traceId: item.langfuse_trace_id
      }),
      approved_at: new Date().toISOString(),
      approved_by: userId,
      rejected_at: null,
      published_post_id: publishedPostId
    })
    .eq("id", item.id);

  if (error) {
    throw new Error(error.message);
  }

  trackStoryEvent({
    importItemId: item.id,
    name: "community-import.publish",
    output: {
      comment_count: publishedComments.length,
      published_post_id: publishedPostId,
      status: "approved"
    },
    source: item.source,
    sourceStoryId: item.source_story_id,
    traceId: item.langfuse_trace_id
  });

  return commentWarning || (item.published_post_id ? "Post updated." : "Post published.");
}

async function resolvePublishedPostId(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  communitySpaceId: string;
  draft: ReturnType<typeof readPublishDraft>;
  importItemId: string;
  publishedPostId: string | null;
  source: string;
}) {
  const { admin, communitySpaceId, draft, importItemId, publishedPostId, source } = params;
  const author = await ensureCommunityAuthor({
    admin,
    authorKey: draft.publicAuthorKey,
    authorLabel: draft.publicAuthorLabel,
    source
  });

  if (publishedPostId) {
    const { error } = await admin
      .from("community_posts")
      .update({
        author_id: author.id,
        author_label: author.authorLabel,
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
        space_id: communitySpaceId,
        import_item_id: importItemId
      })
      .eq("id", publishedPostId);

    if (error) {
      throw new Error(error.message);
    }

    return publishedPostId;
  }

  const { data: existingPost, error: existingPostError } = await admin
    .from("community_posts")
    .select("id")
    .eq("import_item_id", importItemId)
    .maybeSingle();

  if (existingPostError) {
    throw new Error(existingPostError.message);
  }

  if (existingPost) {
    const { error } = await admin
      .from("community_posts")
      .update({
        author_id: author.id,
        author_label: author.authorLabel,
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
        space_id: communitySpaceId
      })
      .eq("id", existingPost.id);

    if (error) {
      throw new Error(error.message);
    }

    return existingPost.id;
  }

  const { data: insertedPost, error } = await admin
    .from("community_posts")
    .insert({
      author_id: author.id,
      author_label: author.authorLabel,
      title: draft.title,
      body: draft.body,
      tags: draft.tags,
      space_id: communitySpaceId,
      import_item_id: importItemId,
      user_id: null
    })
    .select("id")
    .single();

  if (!error && insertedPost) {
    return insertedPost.id;
  }

  if (error?.code === "23505") {
    const { data: retryPost, error: retryPostError } = await admin
      .from("community_posts")
      .select("id")
      .eq("import_item_id", importItemId)
      .maybeSingle();

    if (retryPostError || !retryPost) {
      throw new Error(retryPostError?.message ?? "Unable to resolve duplicate published post.");
    }

    return retryPost.id;
  }

  throw new Error(error?.message ?? "Unable to publish community post.");
}

async function runReviewCommunityImportAction({
  itemId,
  intent,
  moderationNotes
}: {
  itemId: string;
  intent: string;
  moderationNotes: string;
}): Promise<ReviewCommunityImportActionState> {

  if (!itemId) {
    throw new Error("Import item id is required.");
  }

  if (intent !== "approve" && intent !== "reject" && intent !== "unpublish") {
    throw new Error("Unknown review action.");
  }

  const user = await requireReviewer();
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: item, error: itemError } = await admin
    .from("community_import_items")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();

  if (itemError || !item) {
    throw new Error(itemError?.message ?? "Import item not found.");
  }

  if (intent === "unpublish") {
    if (!item.published_post_id) {
      throw new Error("This item is not currently published.");
    }

    await admin.from("community_post_comments").delete().eq("post_id", item.published_post_id).eq("import_item_id", item.id);
    await admin.from("community_posts").delete().eq("id", item.published_post_id);

    const { error } = await admin
      .from("community_import_items")
      .update({
        moderation_status: "pending",
        observability_metadata: buildStoryObservabilityMetadata({
          importItemId: item.id,
          moderationStatus: "pending",
          publishedPostId: null,
          source: item.source,
          sourcePayloadPrivate: item.source_payload_private as Json,
          sourceStoryId: item.source_story_id,
          traceId: item.langfuse_trace_id
        }),
        published_post_id: null,
        approved_at: null,
        approved_by: null
      })
      .eq("id", item.id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/admin/community-imports");
    revalidatePath("/community");

    trackStoryEvent({
      importItemId: item.id,
      metadata: {
        reviewer_hash: hashReviewerId(user.id)
      },
      name: "community-import.human-review",
      output: {
        intent,
        moderation_notes_length: moderationNotes.length,
        published_post_id: null
      },
      source: item.source,
      sourceStoryId: item.source_story_id,
      traceId: item.langfuse_trace_id
    });
    scoreStoryTrace({
      comment: moderationNotes || undefined,
      dataType: "BOOLEAN",
      importItemId: item.id,
      name: "human_review_approved",
      source: item.source,
      sourceStoryId: item.source_story_id,
      traceId: item.langfuse_trace_id,
      value: 0
    });

    return {
      status: "success",
      message: "Post unpublished and reset to pending."
    };
  }

  if (intent === "reject") {
    const { error } = await admin
      .from("community_import_items")
      .update({
        moderation_status: "rejected",
        moderation_notes: moderationNotes || null,
        observability_metadata: buildStoryObservabilityMetadata({
          importItemId: item.id,
          moderationStatus: "rejected",
          publishedPostId: item.published_post_id,
          source: item.source,
          sourcePayloadPrivate: item.source_payload_private as Json,
          sourceStoryId: item.source_story_id,
          traceId: item.langfuse_trace_id
        }),
        rejected_at: now,
        approved_at: null,
        approved_by: null
      })
      .eq("id", item.id);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/admin/community-imports");
    revalidatePath("/community");

    trackStoryEvent({
      importItemId: item.id,
      metadata: {
        reviewer_hash: hashReviewerId(user.id)
      },
      name: "community-import.human-review",
      output: {
        intent,
        moderation_notes_length: moderationNotes.length,
        published_post_id: item.published_post_id
      },
      source: item.source,
      sourceStoryId: item.source_story_id,
      traceId: item.langfuse_trace_id
    });
    scoreStoryTrace({
      comment: moderationNotes || undefined,
      dataType: "BOOLEAN",
      importItemId: item.id,
      name: "human_review_approved",
      source: item.source,
      sourceStoryId: item.source_story_id,
      traceId: item.langfuse_trace_id,
      value: 0
    });

    return {
      status: "success",
      message: "Review marked as rejected."
    };
  } else {
    const parsedDraft = readPublishDraft(item.publish_draft, item.source_payload_private, item.source_story_id);
    const traceContext = {
      importItemId: item.id,
      source: item.source,
      sourceStoryId: item.source_story_id,
      traceId: item.langfuse_trace_id
    };
    const draft = await buildPublishedPostDraft({
      rawPublishDraft: item.publish_draft,
      rawSourcePayloadPrivate: item.source_payload_private,
      parsedDraft,
      traceContext
    });
    const publishedComments = await buildPublishedComments({
      rawPublishDraft: item.publish_draft,
      rawSourcePayloadPrivate: item.source_payload_private,
      parsedDraft,
      traceContext
    });

    if (!draft.title || !draft.body) {
      throw new Error("This draft is missing public content.");
    }
    const publishMessage = await publishCommunityImportItem({
      admin,
      draft,
      item,
      moderationNotes,
      publishedComments,
      userId: user.id
    });

    trackStoryEvent({
      importItemId: item.id,
      metadata: {
        reviewer_hash: hashReviewerId(user.id)
      },
      name: "community-import.human-review",
      output: {
        intent,
        moderation_notes_length: moderationNotes.length,
        published_post_id: item.published_post_id ?? null
      },
      source: item.source,
      sourceStoryId: item.source_story_id,
      traceId: item.langfuse_trace_id
    });
    scoreStoryTrace({
      comment: moderationNotes || undefined,
      dataType: "BOOLEAN",
      importItemId: item.id,
      name: "human_review_approved",
      source: item.source,
      sourceStoryId: item.source_story_id,
      traceId: item.langfuse_trace_id,
      value: 1
    });

    revalidatePath("/admin/community-imports");
    revalidatePath("/community");

    return {
      status: "success",
      message: publishMessage
    };
  }
}

export async function autoReviewPendingCommunityImportsAction(
  _previousState: ReviewCommunityImportActionState
): Promise<ReviewCommunityImportActionState> {
  try {
    const user = await requireReviewer();
    const admin = createSupabaseAdminClient();
    const { data: items, error } = await admin
      .from("community_import_items")
      .select("*")
      .eq("moderation_status", "pending")
      .order("created_at", { ascending: true })
      .limit(25);

    if (error) {
      throw new Error(error.message);
    }

    if (!items || items.length === 0) {
      return {
        status: "success",
        message: "No pending items to auto-review."
      };
    }

    let approvedCount = 0;
    let needsRevisionCount = 0;
    let errorCount = 0;

    for (const item of items) {
      try {
        const parsedDraft = readPublishDraft(item.publish_draft, item.source_payload_private, item.source_story_id);
        const traceContext = {
          importItemId: item.id,
          source: item.source,
          sourceStoryId: item.source_story_id,
          traceId: item.langfuse_trace_id
        };
        const publishedDraft = await buildPublishedPostDraft({
          rawPublishDraft: item.publish_draft,
          rawSourcePayloadPrivate: item.source_payload_private,
          parsedDraft,
          traceContext
        });
        const publishedComments = await buildPublishedComments({
          rawPublishDraft: item.publish_draft,
          rawSourcePayloadPrivate: item.source_payload_private,
          parsedDraft,
          traceContext
        });
        const verdict = await evaluatePreparedCommunityImport({
          publishedComments,
          publishedDraft,
          rawSourcePayloadPrivate: item.source_payload_private,
          traceContext
        });

        if (verdict.approve) {
          await publishCommunityImportItem({
            admin,
            draft: publishedDraft,
            item,
            moderationNotes: formatAutoReviewNotes(verdict, "Auto-approved."),
            publishedComments,
            userId: user.id
          });
          approvedCount += 1;
          continue;
        }

        const { error: updateError } = await admin
          .from("community_import_items")
          .update({
            moderation_status: "needs_revision",
            moderation_notes: formatAutoReviewNotes(verdict, "Auto-review flagged for revision."),
            observability_metadata: buildStoryObservabilityMetadata({
              importItemId: item.id,
              moderationStatus: "needs_revision",
              publishedPostId: item.published_post_id,
              source: item.source,
              sourcePayloadPrivate: item.source_payload_private as Json,
              sourceStoryId: item.source_story_id,
              traceId: item.langfuse_trace_id
            })
          })
          .eq("id", item.id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        needsRevisionCount += 1;
      } catch (itemError) {
        errorCount += 1;
        await admin
          .from("community_import_items")
          .update({
            moderation_notes: `Auto-review error: ${itemError instanceof Error ? itemError.message : "Unknown error."}`
          })
          .eq("id", item.id);
      }
    }

    revalidatePath("/admin/community-imports");
    revalidatePath("/community");

    return {
      status: "success",
      message: `Auto-review processed ${items.length} item(s): ${approvedCount} published, ${needsRevisionCount} marked needs revision, ${errorCount} errored.`
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to auto-review pending items."
    };
  }
}
