import fs from "node:fs/promises";

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const SOURCE = "reddit";
const LEGAL_CAVEAT = "Community experience only, not legal advice.";

function readObject(value) {
  return typeof value === "object" && value !== null ? value : {};
}

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCommentBody(body) {
  return body
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizePostBody(body) {
  return body
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildAnonymousCommentAuthor(index) {
  return `Haven_User_${String(index + 1).padStart(3, "0")}`;
}

function buildPublicAuthorLabel(index) {
  return `Haven_User_${String(500 + index).padStart(3, "0")}`;
}

async function generateDraft(openai, model, story, index) {
  const prompt = [
    "Create a safe public forum draft from this immigration community story.",
    "Requirements:",
    "- Keep the post in first person.",
    "- Preserve the key immigration facts, timeline logic, and main question or outcome.",
    "- Make it less identifiable than the source. Do not copy source phrasing.",
    "- Keep it concise and useful.",
    "- Rewrite comments so they preserve practical advice but do not read exactly like the originals.",
    "- Use calm, practical forum language.",
    "- Set publish_ready to false only if privacy risk or lack of clarity is too high for public posting.",
    "- Use only tags that are directly supported by the source.",
    "- quality_score should be 0 to 100.",
    "",
    JSON.stringify(story)
  ].join("\n");

  const response = await openai.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: "You transform immigration forum stories into anonymized review drafts for a public community forum." }]
      },
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "community_import_publish_draft",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "body",
            "situation_summary",
            "actions_taken",
            "outcome_summary",
            "community_takeaways",
            "comment_insights",
            "risk_notes",
            "tags",
            "comments",
            "quality_score",
            "privacy_flags",
            "moderation_flags",
            "publish_ready"
          ],
          properties: {
            title: { type: "string" },
            body: { type: "string" },
            situation_summary: { type: "string" },
            actions_taken: { type: "array", items: { type: "string" } },
            outcome_summary: { type: "string" },
            community_takeaways: { type: "array", items: { type: "string" } },
            comment_insights: { type: "array", items: { type: "string" } },
            risk_notes: { type: "array", items: { type: "string" } },
            tags: { type: "array", items: { type: "string" } },
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
            },
            quality_score: { type: "number" },
            privacy_flags: { type: "array", items: { type: "string" } },
            moderation_flags: { type: "array", items: { type: "string" } },
            publish_ready: { type: "boolean" }
          }
        }
      }
    }
  });

  const parsed = JSON.parse(response.output_text ?? "{}");
  const comments = Array.isArray(parsed.comments)
    ? parsed.comments
        .map((comment, commentIndex) => {
          const body = normalizeCommentBody(readString(readObject(comment).body));
          return body ? { author_label: buildAnonymousCommentAuthor(commentIndex), body } : null;
        })
        .filter(Boolean)
    : [];

  return {
    version: 1,
    public_author_label: buildPublicAuthorLabel(index + 1),
    title: readString(parsed.title),
    body: normalizePostBody(readString(parsed.body)),
    situation_summary: readString(parsed.situation_summary),
    actions_taken: Array.isArray(parsed.actions_taken) ? parsed.actions_taken.map(readString).filter(Boolean) : [],
    outcome_summary: readString(parsed.outcome_summary),
    community_takeaways: Array.isArray(parsed.community_takeaways) ? parsed.community_takeaways.map(readString).filter(Boolean) : [],
    comment_insights: Array.isArray(parsed.comment_insights) ? parsed.comment_insights.map(readString).filter(Boolean) : [],
    risk_notes: Array.isArray(parsed.risk_notes) ? parsed.risk_notes.map(readString).filter(Boolean) : [],
    legal_caveat: LEGAL_CAVEAT,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(readString).filter(Boolean) : [],
    comments,
    tone: "calm_practical",
    quality_score: typeof parsed.quality_score === "number" ? parsed.quality_score : 70,
    privacy_flags: Array.isArray(parsed.privacy_flags) ? parsed.privacy_flags.map(readString).filter(Boolean) : [],
    moderation_flags: Array.isArray(parsed.moderation_flags) ? parsed.moderation_flags.map(readString).filter(Boolean) : [],
    publish_ready: Boolean(parsed.publish_ready)
  };
}

async function getDefaultCommunitySpaceId(supabase) {
  const defaultForumName = "Community Forum";
  const defaultForumSummary = "Main forum for moderated community posts.";

  const { data: existingDefaultSpace, error: existingDefaultSpaceError } = await supabase
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

  const { data: createdSpace, error: createSpaceError } = await supabase
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

async function resolvePublishedPostId(supabase, params) {
  const { communitySpaceId, draft, importItemId, publishedPostId } = params;

  if (publishedPostId) {
    const { error } = await supabase
      .from("community_posts")
      .update({
        author_label: draft.public_author_label,
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

  const { data: existingPost, error: existingPostError } = await supabase
    .from("community_posts")
    .select("id")
    .eq("import_item_id", importItemId)
    .maybeSingle();

  if (existingPostError) {
    throw new Error(existingPostError.message);
  }

  if (existingPost) {
    const { error } = await supabase
      .from("community_posts")
      .update({
        author_label: draft.public_author_label,
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

  const { data: insertedPost, error } = await supabase
    .from("community_posts")
    .insert({
      author_label: draft.public_author_label,
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
    const { data: retryPost, error: retryPostError } = await supabase
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

async function syncImportedComments(supabase, params) {
  const { comments, itemId, postId } = params;

  const { error: deleteCommentsError } = await supabase
    .from("community_post_comments")
    .delete()
    .eq("post_id", postId)
    .eq("import_item_id", itemId);

  if (deleteCommentsError) {
    throw new Error(deleteCommentsError.message);
  }

  if (comments.length === 0) {
    return;
  }

  const { error: insertCommentsError } = await supabase
    .from("community_post_comments")
    .insert(
      comments.map((comment, index) => ({
        post_id: postId,
        import_item_id: itemId,
        user_id: null,
        author_label: buildAnonymousCommentAuthor(index),
        body: normalizeCommentBody(comment.body),
        sort_order: index
      }))
    );

  if (insertCommentsError) {
    throw new Error(insertCommentsError.message);
  }
}

async function main() {
  const batchPath = process.argv[2];
  if (!batchPath) {
    throw new Error("Usage: node scripts/community/import-curated-stories.mjs <batch.json>");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!supabaseUrl || !serviceRoleKey || !openAiKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENAI_API_KEY.");
  }

  const raw = await fs.readFile(batchPath, "utf8");
  const batch = JSON.parse(raw);
  if (!Array.isArray(batch.stories) || batch.stories.length === 0) {
    throw new Error("Batch file must include a non-empty stories array.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  const openai = new OpenAI({ apiKey: openAiKey });
  const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
  const source = readString(batch.source) || SOURCE;
  const note = readString(batch.note);

  const generated = [];
  for (let index = 0; index < batch.stories.length; index += 1) {
    const story = batch.stories[index];
    const publishDraft = await generateDraft(openai, model, story, index);
    generated.push({
      source_story_id: story.source_story_id,
      source_payload_private: {
        title: story.title,
        body: story.body,
        comments: Array.isArray(story.comments)
          ? story.comments.map((body, commentIndex) => ({
              id: `${story.source_story_id}_c${commentIndex + 1}`,
              author: "Reddit user",
              body,
              body_translated: null,
              score: null
            }))
          : [],
        source_url: story.source_url,
        author_name: story.author_name ?? "Reddit user"
      },
      publish_draft: publishDraft
    });
  }

  const { data: runRow, error: runInsertError } = await supabase
    .from("community_import_runs")
    .insert({
      source,
      status: "received",
      item_count: generated.length,
      duplicate_count: 0,
      notes: note || null
    })
    .select("id")
    .single();

  if (runInsertError || !runRow) {
    throw new Error(runInsertError?.message ?? "Unable to create import run.");
  }

  const rowsToUpsert = generated.map((item) => ({
    run_id: runRow.id,
    source,
    source_story_id: item.source_story_id,
    language: "en",
    source_payload_private: item.source_payload_private,
    publish_draft: item.publish_draft,
    moderation_status: item.publish_draft.publish_ready ? "pending" : "needs_revision"
  }));

  const { error: upsertError } = await supabase
    .from("community_import_items")
    .upsert(rowsToUpsert, { onConflict: "source,source_story_id" });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  const { data: importedItems, error: importedItemsError } = await supabase
    .from("community_import_items")
    .select("id, source_story_id, publish_draft, published_post_id")
    .eq("run_id", runRow.id);

  if (importedItemsError) {
    throw new Error(importedItemsError.message);
  }

  const communitySpaceId = await getDefaultCommunitySpaceId(supabase);
  const published = [];
  const queued = [];

  for (const item of importedItems ?? []) {
    const draft = readObject(item.publish_draft);
    if (!draft.publish_ready) {
      queued.push({
        id: item.id,
        source_story_id: item.source_story_id,
        reason: "publish_ready=false"
      });
      continue;
    }

    const comments = Array.isArray(draft.comments)
      ? draft.comments
          .map((comment, index) => {
            const body = normalizeCommentBody(readString(readObject(comment).body));
            return body ? { authorLabel: buildAnonymousCommentAuthor(index), body } : null;
          })
          .filter(Boolean)
      : [];

    const postId = await resolvePublishedPostId(supabase, {
      communitySpaceId,
      draft,
      importItemId: item.id,
      publishedPostId: item.published_post_id
    });

    await syncImportedComments(supabase, {
      comments,
      itemId: item.id,
      postId
    });

    const { error: updateError } = await supabase
      .from("community_import_items")
      .update({
        moderation_status: "approved",
        moderation_notes: "Auto-approved after curated import of clear-outcome stories with practical responses.",
        approved_at: new Date().toISOString(),
        approved_by: null,
        rejected_at: null,
        published_post_id: postId
      })
      .eq("id", item.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    published.push({
      id: item.id,
      source_story_id: item.source_story_id,
      post_id: postId,
      title: draft.title
    });
  }

  const { error: runUpdateError } = await supabase
    .from("community_import_runs")
    .update({
      status: "completed",
      inserted_count: generated.length,
      updated_count: 0,
      finished_at: new Date().toISOString(),
      notes: note ? `${note} Imported ${generated.length} stories. Auto-approved ${published.length}. Left ${queued.length} in review.` : `Imported ${generated.length} stories. Auto-approved ${published.length}. Left ${queued.length} in review.`
    })
    .eq("id", runRow.id);

  if (runUpdateError) {
    throw new Error(runUpdateError.message);
  }

  console.log(JSON.stringify({
    runId: runRow.id,
    imported: generated.length,
    autoApproved: published.length,
    leftInReview: queued.length,
    published,
    queued
  }, null, 2));
}

await main();
