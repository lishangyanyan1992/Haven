"use server";

import { revalidatePath } from "next/cache";
import OpenAI from "openai";

import { buildAnonymousCommentAuthor, readPublishDraft } from "@/lib/community-imports";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

function summarizeList(items: string[]) {
  return items.filter(Boolean).join(" | ");
}

async function rewriteCommentBodiesWithAI(commentBodies: string[]) {
  const client = getOpenAIClient();

  if (!client || commentBodies.length === 0) {
    return commentBodies;
  }

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

  try {
    const response = await (client.responses.create as Function)({
      model: getChatModel(),
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: "You rewrite forum comments into concise paraphrases." }]
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
      return rewritten;
    }
  } catch {
    // Fall back to normalized comments below.
  }

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
}) {
  const client = getOpenAIClient();
  const fallback = {
    title: buildFallbackForumTitle(params.draftTitle) || params.draftTitle,
    body: buildFallbackForumBody(params.draftBody) || params.draftBody
  };

  if (!client) {
    return fallback;
  }

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

  try {
    const response = await (client.responses.create as Function)({
      model: getChatModel(),
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: "You rewrite forum posts into less identifiable public summaries while preserving the same meaning." }]
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
      return { title, body };
    }
  } catch {
    // Fall back to deterministic rewrite below.
  }

  return fallback;
}

async function buildPublishedComments(params: {
  rawPublishDraft: unknown;
  rawSourcePayloadPrivate: unknown;
}) {
  const providedCommentBodies = extractProvidedCommentBodies(params.rawPublishDraft);

  if (providedCommentBodies.length > 0) {
    return providedCommentBodies.map((body, index) => ({
      authorLabel: buildAnonymousCommentAuthor(index),
      body
    }));
  }

  const sourceCommentBodies = extractSourceCommentBodies(params.rawSourcePayloadPrivate);
  const rewrittenSourceCommentBodies = await rewriteCommentBodiesWithAI(sourceCommentBodies);

  return rewrittenSourceCommentBodies.map((body, index) => ({
    authorLabel: buildAnonymousCommentAuthor(index),
    body
  }));
}

async function buildPublishedPostDraft(params: {
  rawPublishDraft: unknown;
  rawSourcePayloadPrivate: unknown;
  parsedDraft: ReturnType<typeof readPublishDraft>;
}) {
  const source = readObject(params.rawSourcePayloadPrivate);
  const sourceTitle = readString(source.title);
  const sourceBody = normalizePostBody(readString(source.body));

  const rewritten = await rewriteForumPostWithAI({
    sourceBody,
    sourceTitle,
    draftBody: params.parsedDraft.body,
    draftTitle: params.parsedDraft.title
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

  try {
    const response = await (client.responses.create as Function)({
      model: getChatModel(),
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: "You are a strict QA reviewer for anonymized forum rewrites." }]
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
      return {
        ...parsed,
        issues: Array.isArray(parsed.issues) ? parsed.issues.filter((issue) => typeof issue === "string" && issue.trim().length > 0) : []
      };
    }
  } catch {
    // Fall back to deterministic review below.
  }

  return fallbackAutoReviewVerdict({
    publishedBody: params.publishedDraft.body,
    publishedComments,
    sourceBody,
    sourceComments
  });
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

async function requireReviewer() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  const allowedEmails = getAllowedReviewerEmails();
  const email = user.email?.toLowerCase() ?? "";

  if (allowedEmails.size > 0 && !allowedEmails.has(email)) {
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
  comments: Array<{ authorLabel: string; body: string }>;
}) {
  const { admin, comments, itemId, postId } = params;

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

  const { error: insertCommentsError } = await admin.from("community_post_comments").insert(
    comments.map((comment, index) => ({
      post_id: postId,
      import_item_id: itemId,
      user_id: null,
      author_label: comment.authorLabel,
      body: comment.body,
      sort_order: index
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
    published_post_id: string | null;
  };
  moderationNotes: string;
  publishedComments: Array<{ authorLabel: string; body: string }>;
  userId: string;
}) {
  const { admin, draft, item, moderationNotes, publishedComments, userId } = params;
  const communitySpaceId = await getDefaultCommunitySpaceId(admin);
  const publishedPostId = await resolvePublishedPostId({
    admin,
    communitySpaceId,
    draft,
    importItemId: item.id,
    publishedPostId: item.published_post_id
  });

  if (!publishedPostId) {
    throw new Error("Unable to resolve published post id.");
  }

  const commentWarning = await syncImportedComments({
    admin,
    comments: publishedComments,
    itemId: item.id,
    postId: publishedPostId
  });

  const { error } = await admin
    .from("community_import_items")
    .update({
      moderation_status: "approved",
      moderation_notes: moderationNotes || null,
      approved_at: new Date().toISOString(),
      approved_by: userId,
      rejected_at: null,
      published_post_id: publishedPostId
    })
    .eq("id", item.id);

  if (error) {
    throw new Error(error.message);
  }

  return commentWarning || (item.published_post_id ? "Post updated." : "Post published.");
}

async function resolvePublishedPostId(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  communitySpaceId: string;
  draft: ReturnType<typeof readPublishDraft>;
  importItemId: string;
  publishedPostId: string | null;
}) {
  const { admin, communitySpaceId, draft, importItemId, publishedPostId } = params;

  if (publishedPostId) {
    const { error } = await admin
      .from("community_posts")
      .update({
        author_label: draft.publicAuthorLabel,
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
        author_label: draft.publicAuthorLabel,
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
      author_label: draft.publicAuthorLabel,
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

  if (intent !== "approve" && intent !== "reject") {
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

  if (intent === "reject") {
    if (item.published_post_id) {
      throw new Error("This item is already published.");
    }

    const { error } = await admin
      .from("community_import_items")
      .update({
        moderation_status: "rejected",
        moderation_notes: moderationNotes || null,
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

    return {
      status: "success",
      message: "Review marked as rejected."
    };
  } else {
    const parsedDraft = readPublishDraft(item.publish_draft, item.source_payload_private);
    const draft = await buildPublishedPostDraft({
      rawPublishDraft: item.publish_draft,
      rawSourcePayloadPrivate: item.source_payload_private,
      parsedDraft
    });
    const publishedComments = await buildPublishedComments({
      rawPublishDraft: item.publish_draft,
      rawSourcePayloadPrivate: item.source_payload_private
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
        const parsedDraft = readPublishDraft(item.publish_draft, item.source_payload_private);
        const publishedDraft = await buildPublishedPostDraft({
          rawPublishDraft: item.publish_draft,
          rawSourcePayloadPrivate: item.source_payload_private,
          parsedDraft
        });
        const publishedComments = await buildPublishedComments({
          rawPublishDraft: item.publish_draft,
          rawSourcePayloadPrivate: item.source_payload_private
        });
        const verdict = await evaluatePreparedCommunityImport({
          publishedComments,
          publishedDraft,
          rawSourcePayloadPrivate: item.source_payload_private
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
            moderation_notes: formatAutoReviewNotes(verdict, "Auto-review flagged for revision.")
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
