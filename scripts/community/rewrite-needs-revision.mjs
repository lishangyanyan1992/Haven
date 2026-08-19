/**
 * rewrite-needs-revision.mjs
 *
 * Scans community_import_items for stories stuck in "needs_revision" status,
 * re-sends the original source to OpenAI with a retry-focused prompt that
 * addresses the specific privacy_flags / moderation_flags that caused the
 * initial rejection. If the new draft comes back publish_ready=true, the
 * story is published to community_posts + community_post_comments (same
 * flow as the main import pipeline).
 *
 * Usage:  node scripts/community/rewrite-needs-revision.mjs
 *
 * Env:    NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY
 *         OPENAI_CHAT_MODEL (optional, default gpt-4o-mini)
 */

import fs from "node:fs/promises";
import crypto from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const LEGAL_CAVEAT = "Community experience only, not legal advice.";

// ---------------------------------------------------------------------------
// Helpers (mirrored from import-curated-stories.mjs)
// ---------------------------------------------------------------------------

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

function stableNumber(seed, min, max) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return min + (hash % (max - min + 1));
}

function buildAnonymousCommentAuthor(index, seed = "") {
  const personas = [
    "Community member",
    "Fellow applicant",
    "Forum member",
    "Case sharer",
    "Timeline reader",
    "Status tracker",
    "Visa peer",
    "Immigration peer",
  ];
  const stableSeed = seed || `comment:${index + 1}`;
  const persona =
    personas[stableNumber(`${stableSeed}:persona`, 0, personas.length - 1)] ??
    "Community member";
  const suffix = stableNumber(`${stableSeed}:suffix`, 100, 999);
  return `${persona} ${suffix}`;
}

function buildPublicAuthorLabel(index) {
  return `Haven_User_${String(500 + index).padStart(3, "0")}`;
}

// ---------------------------------------------------------------------------
// Re-draft generation with retry-focused prompt
// ---------------------------------------------------------------------------

async function regenerateDraft(openai, model, story, previousDraft) {
  const prevFlags = readObject(previousDraft);
  const privacyFlags = Array.isArray(prevFlags.privacy_flags)
    ? prevFlags.privacy_flags.map(readString).filter(Boolean)
    : [];
  const moderationFlags = Array.isArray(prevFlags.moderation_flags)
    ? prevFlags.moderation_flags.map(readString).filter(Boolean)
    : [];
  const riskNotes = Array.isArray(prevFlags.risk_notes)
    ? prevFlags.risk_notes.map(readString).filter(Boolean)
    : [];

  const retryGuidance = [
    "A previous AI review flagged this story and set publish_ready=false.",
    "The previous review identified these issues that MUST be resolved:",
  ];

  if (privacyFlags.length > 0) {
    retryGuidance.push(`Privacy flags: ${privacyFlags.join("; ")}`);
  }
  if (moderationFlags.length > 0) {
    retryGuidance.push(`Moderation flags: ${moderationFlags.join("; ")}`);
  }
  if (riskNotes.length > 0) {
    retryGuidance.push(`Risk notes: ${riskNotes.join("; ")}`);
  }

  retryGuidance.push(
    "",
    "To fix these issues you may:",
    "- Remove or generalize any personally identifying details (employer names, specific dates, case numbers, usernames).",
    "- Rephrase the story to preserve the immigration facts, timeline, and outcome while making it less identifiable.",
    "- Tighten the narrative if the previous draft was unclear or lacked a clear outcome.",
    "- Drop comments that add no practical value or that introduce privacy risk.",
    "",
    "You MUST produce a publish-ready draft unless the privacy risk is truly unrecoverable.",
  );

  const prompt = [
    "Create a safe public forum draft from this immigration community story.",
    "Requirements:",
    "- Keep the post in first person.",
    "- Preserve the key immigration facts, timeline logic, and main question or outcome.",
    "- Make it less identifiable than the source. Do not copy source phrasing.",
    "- Keep it concise and useful.",
    "- Rewrite comments so they preserve practical advice but do not read exactly like the originals.",
    "- Optimize the title, body, tags, and comments for SEO using natural search language that matches the case, such as H-1B layoff, 60-day grace period, H-1B transfer, B-2 bridge, sponsor search, STEM OPT, LCA timing, I-140, PERM, or priority date when supported by the source.",
    "- Put the strongest search phrase in the title when it is accurate, and include practical long-tail phrases in the body and comments without keyword stuffing.",
    "- If the source story has no comments, return an empty comments array.",
    "- Use calm, practical forum language.",
    "- Set publish_ready to false only if privacy risk or lack of clarity is too high for public posting even after rewrites.",
    "- Use only tags that are directly supported by the source.",
    "- quality_score should be 0 to 100.",
    "",
    ...retryGuidance,
    "",
    JSON.stringify(story),
  ].join("\n");

  const response = await openai.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "You transform immigration forum stories into anonymized review drafts for a public community forum.",
          },
        ],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
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
            "publish_ready",
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
                properties: { body: { type: "string" } },
              },
            },
            quality_score: { type: "number" },
            privacy_flags: { type: "array", items: { type: "string" } },
            moderation_flags: { type: "array", items: { type: "string" } },
            publish_ready: { type: "boolean" },
          },
        },
      },
    },
  });

  const parsed = JSON.parse(response.output_text ?? "{}");

  const sourceComments = Array.isArray(story.comments)
    ? story.comments.map((c) => readString(readObject(c).body ?? c)).filter(Boolean)
    : [];
  const draftComments =
    sourceComments.length > 0 && Array.isArray(parsed.comments)
      ? parsed.comments
          .map((comment, ci) => {
            const body = normalizeCommentBody(readString(readObject(comment).body));
            return body
              ? {
                  author_label: buildAnonymousCommentAuthor(
                    ci,
                    `${story.source_story_id}:comment:${ci + 1}`,
                  ),
                  body,
                }
              : null;
          })
          .filter(Boolean)
      : [];
  const fallbackComments = sourceComments.map((body, ci) => ({
    author_label: buildAnonymousCommentAuthor(
      ci,
      `${story.source_story_id}:comment:${ci + 1}`,
    ),
    body: normalizeCommentBody(body),
  }));
  const comments = draftComments.length > 0 ? draftComments : fallbackComments;

  return {
    version: 1,
    public_author_label: prevFlags.public_author_label ?? buildPublicAuthorLabel(1),
    title: readString(parsed.title),
    body: normalizePostBody(readString(parsed.body)),
    situation_summary: readString(parsed.situation_summary),
    actions_taken: Array.isArray(parsed.actions_taken)
      ? parsed.actions_taken.map(readString).filter(Boolean)
      : [],
    outcome_summary: readString(parsed.outcome_summary),
    community_takeaways: Array.isArray(parsed.community_takeaways)
      ? parsed.community_takeaways.map(readString).filter(Boolean)
      : [],
    comment_insights: Array.isArray(parsed.comment_insights)
      ? parsed.comment_insights.map(readString).filter(Boolean)
      : [],
    risk_notes: Array.isArray(parsed.risk_notes)
      ? parsed.risk_notes.map(readString).filter(Boolean)
      : [],
    legal_caveat: LEGAL_CAVEAT,
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(readString).filter(Boolean) : [],
    comments,
    tone: "calm_practical",
    quality_score: typeof parsed.quality_score === "number" ? parsed.quality_score : 70,
    privacy_flags: Array.isArray(parsed.privacy_flags)
      ? parsed.privacy_flags.map(readString).filter(Boolean)
      : [],
    moderation_flags: Array.isArray(parsed.moderation_flags)
      ? parsed.moderation_flags.map(readString).filter(Boolean)
      : [],
    publish_ready: Boolean(parsed.publish_ready),
  };
}

// ---------------------------------------------------------------------------
// Publishing (mirrors resolvePublishedPostId + syncImportedComments)
// ---------------------------------------------------------------------------

async function getDefaultCommunitySpaceId(supabase) {
  const { data, error } = await supabase
    .from("community_spaces")
    .select("id")
    .eq("space_type", "cohort")
    .eq("name", "Community Forum")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return data.id;

  const { data: created, error: createErr } = await supabase
    .from("community_spaces")
    .insert({ name: "Community Forum", space_type: "cohort", summary: "Main forum for moderated community posts." })
    .select("id")
    .single();

  if (createErr || !created) throw new Error(createErr?.message ?? "Unable to create default community space.");
  return created.id;
}

async function publishDraft(supabase, itemId, draft, sourcePayload, communitySpaceId) {
  // Check if a community_posts row already exists for this import_item_id
  const { data: existingPost } = await supabase
    .from("community_posts")
    .select("id")
    .eq("import_item_id", itemId)
    .maybeSingle();

  let postId;

  const sourceDateUpdate = sourcePayload.source_created_at
    ? { created_at: sourcePayload.source_created_at }
    : {};

  if (existingPost) {
    // Update existing post
    const { error } = await supabase
      .from("community_posts")
      .update({
        author_label: draft.public_author_label,
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
        space_id: communitySpaceId,
        ...sourceDateUpdate,
      })
      .eq("id", existingPost.id);

    if (error) throw new Error(error.message);
    postId = existingPost.id;
  } else {
    // Insert new post
    const { data: inserted, error } = await supabase
      .from("community_posts")
      .insert({
        author_label: draft.public_author_label,
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
        space_id: communitySpaceId,
        import_item_id: itemId,
        user_id: null,
        ...sourceDateUpdate,
      })
      .select("id")
      .single();

    if (error?.code === "23505") {
      // Race condition - fetch existing
      const { data: retry } = await supabase
        .from("community_posts")
        .select("id")
        .eq("import_item_id", itemId)
        .maybeSingle();
      if (!retry) throw new Error("Unable to resolve duplicate published post.");
      postId = retry.id;
    } else if (error || !inserted) {
      throw new Error(error?.message ?? "Unable to publish community post.");
    } else {
      postId = inserted.id;
    }
  }

  // Sync comments: delete old, insert new
  await supabase
    .from("community_post_comments")
    .delete()
    .eq("post_id", postId)
    .eq("import_item_id", itemId);

  const comments = Array.isArray(draft.comments)
    ? draft.comments
        .map((c, i) => {
          const body = normalizeCommentBody(readString(readObject(c).body));
          return body
            ? {
                post_id: postId,
                import_item_id: itemId,
                user_id: null,
                author_label: c.author_label || buildAnonymousCommentAuthor(i, `${itemId}:comment:${i + 1}`),
                body,
                sort_order: i,
              }
            : null;
        })
        .filter(Boolean)
    : [];

  if (comments.length > 0) {
    const { error: cErr } = await supabase.from("community_post_comments").insert(comments);
    if (cErr) throw new Error(cErr.message);
  }

  return postId;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !serviceRoleKey || !openAiKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENAI_API_KEY.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const openai = new OpenAI({ apiKey: openAiKey });
  const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

  // 1. Fetch all needs_revision items with no published_post_id
  const { data: items, error: queryError } = await supabase
    .from("community_import_items")
    .select("id, source_story_id, source_payload_private, publish_draft, observability_metadata")
    .eq("moderation_status", "needs_revision")
    .is("published_post_id", null)
    .order("created_at", { ascending: true })
    .limit(20);

  if (queryError) throw new Error(queryError.message);

  if (!items || items.length === 0) {
    console.log(JSON.stringify({ scanned: 0, republished: 0, stillRevising: 0, message: "No needs_revision items found." }));
    return;
  }

  console.error(`Found ${items.length} needs_revision item(s). Starting re-draft...`);

  const communitySpaceId = await getDefaultCommunitySpaceId(supabase);

  const republished = [];
  const stillRevising = [];

  for (const item of items) {
    const sourcePayload = readObject(item.source_payload_private);
    const previousDraft = readObject(item.publish_draft);

    // Reconstruct story object for the AI
    const story = {
      source_story_id: item.source_story_id,
      title: readString(sourcePayload.title),
      body: readString(sourcePayload.body),
      comments: Array.isArray(sourcePayload.comments)
        ? sourcePayload.comments.map((c) => readObject(c).body ?? readString(c))
        : [],
      source_url: readString(sourcePayload.source_url),
      author_name: readString(sourcePayload.author_name),
      source_created_at: sourcePayload.source_created_at,
      created_utc: sourcePayload.created_utc,
    };

    let draft;
    try {
      draft = await regenerateDraft(openai, model, story, previousDraft);
    } catch (err) {
      console.error(`  ${item.source_story_id}: OpenAI error — ${err.message}`);
      stillRevising.push({ id: item.id, source_story_id: item.source_story_id, reason: `openai_error: ${err.message}` });
      continue;
    }

    if (draft.publish_ready) {
      // Publish it
      try {
        const postId = await publishDraft(supabase, item.id, draft, sourcePayload, communitySpaceId);

        await supabase
          .from("community_import_items")
          .update({
            moderation_status: "approved",
            moderation_notes: "Auto-approved after rewrite retry resolved privacy/clarity issues.",
            approved_at: new Date().toISOString(),
            approved_by: null,
            publish_draft: draft,
            published_post_id: postId,
          })
          .eq("id", item.id);

        republished.push({ id: item.id, source_story_id: item.source_story_id, post_id: postId, title: draft.title });
        console.error(`  ${item.source_story_id}: PUBLISHED as post ${postId}`);
      } catch (err) {
        console.error(`  ${item.source_story_id}: publish error — ${err.message}`);
        stillRevising.push({ id: item.id, source_story_id: item.source_story_id, reason: `publish_error: ${err.message}` });
      }
    } else {
      // Still not ready — update the draft with the new attempt
      const obsMeta = readObject(item.observability_metadata);
      const retryCount = (obsMeta.rewrite_retries ?? 0) + 1;

      await supabase
        .from("community_import_items")
        .update({
          publish_draft: draft,
          observability_metadata: { ...obsMeta, rewrite_retries: retryCount, last_rewrite_at: new Date().toISOString() },
        })
        .eq("id", item.id);

      stillRevising.push({
        id: item.id,
        source_story_id: item.source_story_id,
        reason: `publish_ready=false (retry #${retryCount})`,
        privacy_flags: draft.privacy_flags,
        moderation_flags: draft.moderation_flags,
      });
      console.error(`  ${item.source_story_id}: still needs revision (retry #${retryCount})`);
    }

    // Small delay between API calls
    await new Promise((r) => setTimeout(r, 2000));
  }

  const summary = {
    scanned: items.length,
    republished: republished.length,
    stillRevising: stillRevising.length,
    republished,
    stillRevising,
  };

  // Write summary file for the monitor job to pick up
  const summaryDir = process.env.REWRITE_SUMMARY_DIR ?? "/tmp/daily-reddit-import";
  try {
    await fs.mkdir(summaryDir, { recursive: true });
    await fs.writeFile(
      `${summaryDir}/rewrite_summary.txt`,
      `[${new Date().toISOString()}] Rewrite-needs-revision run\n` +
        `  Scanned: ${summary.scanned} needs_revision items\n` +
        `  Republished: ${summary.republished}\n` +
        `  Still revising: ${summary.stillRevising}\n` +
        (republished.length > 0
          ? `\nPublished:\n` + republished.map((r) => `  - ${r.source_story_id}: "${r.title}" → post ${r.post_id}`).join("\n")
          : "") +
        (stillRevising.length > 0
          ? `\nStill needs revision:\n` + stillRevising.map((s) => `  - ${s.source_story_id}: ${s.reason}`).join("\n")
          : "") +
        "\n",
      "utf8",
    );
  } catch {
    // Non-fatal
  }

  console.log(JSON.stringify(summary, null, 2));
}

await main();