import fs from "node:fs/promises";
import crypto from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { Langfuse } from "langfuse";
import OpenAI from "openai";

const LEGAL_CAVEAT = "Community experience only, not legal advice.";
const STORY_DRAFT_GENERATION_PROMPT = "haven-story-draft-generation";
const STORY_DRAFT_GENERATION_FALLBACK =
  "You transform immigration forum stories into anonymized review drafts for a public community forum.";

function readObject(value) {
  return typeof value === "object" && value !== null ? value : {};
}

function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stableHash(value) {
  return value ? crypto.createHash("sha256").update(value).digest("hex") : null;
}

function createTraceId() {
  return crypto.randomUUID();
}

function getStoryLangfuseClient() {
  const secretKey = process.env.LANGFUSE_STORY_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_STORY_PUBLIC_KEY;

  if (!secretKey || !publicKey) {
    return null;
  }

  return new Langfuse({
    secretKey,
    publicKey,
    baseUrl: process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com",
    flushAt: 1,
    flushInterval: 0
  });
}

async function getLangfusePrompt(langfuse, name, fallback) {
  if (!langfuse) {
    return { prompt: undefined, text: fallback };
  }

  try {
    const prompt = await langfuse.getPrompt(name, undefined, {
      label: "production",
      cacheTtlSeconds: 60
    });
    const compiled = prompt.compile();
    return { prompt, text: typeof compiled === "string" ? compiled : fallback };
  } catch {
    try {
      const prompt = await langfuse.createPrompt({
        labels: ["production"],
        name,
        prompt: fallback,
        type: "text"
      });
      const compiled = prompt.compile();
      return { prompt, text: typeof compiled === "string" ? compiled : fallback };
    } catch {
      return { prompt: undefined, text: fallback };
    }
  }
}

function summarizeStorySource(story) {
  const sourceUrl = readString(story.source_url);
  const comments = Array.isArray(story.comments) ? story.comments.map(readString).filter(Boolean) : [];
  let sourceDomain = null;

  try {
    sourceDomain = sourceUrl ? new URL(sourceUrl).hostname : null;
  } catch {
    sourceDomain = null;
  }

  return {
    body_hash: stableHash(readString(story.body)),
    body_length: readString(story.body).length,
    comment_count: comments.length,
    comment_hashes: comments.map(stableHash).filter(Boolean),
    comment_lengths: comments.map((comment) => comment.length),
    source_domain: sourceDomain,
    source_url: sourceUrl || null,
    title_hash: stableHash(readString(story.title)),
    title_length: readString(story.title).length
  };
}

async function findCrossBatchDuplicates(supabase, stories, source) {
  const sourceStoryIds = stories.map((s) => s.source_story_id).filter(Boolean);
  const sourceUrls = stories.map((s) => readString(s.source_url)).filter(Boolean);
  const bodyHashes = stories.map((s) => stableHash(readString(s.body))).filter(Boolean);

  const duplicates = new Set();

  if (sourceStoryIds.length > 0) {
    const { data, error } = await supabase
      .from("community_import_items")
      .select("source_story_id")
      .eq("source", source)
      .in("source_story_id", sourceStoryIds);
    if (!error && data) {
      for (const row of data) {
        duplicates.add(row.source_story_id);
      }
    }
  }

  if (sourceUrls.length > 0 || bodyHashes.length > 0) {
    const { data, error } = await supabase
      .from("community_import_items")
      .select("source_story_id, observability_metadata, source_payload_private")
      .eq("source", source);
    if (!error && data) {
      for (const row of data) {
        const obsMeta = readObject(row.observability_metadata);
        const sourceSummary = readObject(obsMeta.source_summary);
        const payload = readObject(row.source_payload_private);
        const existingUrl = readString(payload.source_url);
        const existingBodyHash = readString(sourceSummary.body_hash);
        const existingStoryId = readString(row.source_story_id);

        for (const story of stories) {
          const storyUrl = readString(story.source_url);
          const storyBodyHash = stableHash(readString(story.body));
          if (existingStoryId && story.source_story_id === existingStoryId) {
            duplicates.add(story.source_story_id);
          }
          if (storyUrl && existingUrl && storyUrl === existingUrl) {
            duplicates.add(story.source_story_id);
          }
          if (storyBodyHash && existingBodyHash && storyBodyHash === existingBodyHash) {
            duplicates.add(story.source_story_id);
          }
        }
      }
    }
  }

  return duplicates;
}

function trackStoryEvent(langfuse, params) {
  if (!langfuse || !params.traceId) return;

  try {
    const trace = langfuse.trace({
      id: params.traceId,
      input: params.input,
      metadata: params.metadata,
      name: "story-pipeline",
      sessionId: params.runId,
      tags: ["story-pipeline", params.source ?? "unknown-source"]
    });

    const event = trace?.event;
    if (typeof event === "function") {
      event.call(trace, {
        input: params.input,
        metadata: params.metadata,
        name: params.name,
        output: params.output
      });
      return;
    }

    const span = trace?.span({ input: params.input, metadata: params.metadata, name: params.name });
    span?.end({ output: params.output });
  } catch {
    // Observability must never break imports.
  }
}

function scoreRubric(langfuse, params) {
  if (!langfuse || !params.traceId) return;

  const scores = [
    { name: "rubric_base", value: params.base, max: 20, label: "Base" },
    { name: "rubric_signal", value: params.signal, max: 20, label: "Signal" },
    { name: "rubric_comment_value", value: params.commentValue, max: 10, label: "Comment value" },
    { name: "rubric_total", value: params.total, max: 50, label: "Total" }
  ];

  for (const score of scores) {
    if (typeof score.value !== "number" || !Number.isFinite(score.value)) continue;
    try {
      langfuse.score({
        traceId: params.traceId,
        name: score.name,
        value: score.value,
        dataType: "NUMERIC",
        comment: `${score.label}: ${score.value}/${score.max}${params.tier ? ` (${params.tier})` : ""}`
      });
    } catch {
      // Observability must never break imports.
    }
  }
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
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
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
    "Immigration peer"
  ];
  const stableSeed = seed || `comment:${index + 1}`;
  const persona = personas[stableNumber(`${stableSeed}:persona`, 0, personas.length - 1)] ?? "Community member";
  const suffix = stableNumber(`${stableSeed}:suffix`, 100, 999);

  return `${persona} ${suffix}`;
}

function buildPublicAuthorLabel(index) {
  return `Haven_User_${String(500 + index).padStart(3, "0")}`;
}

function normalizeSourceTimestamp(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const milliseconds = value > 100000000000 ? value : value * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const raw = readString(value);
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T12:00:00.000Z`;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getStorySourcePublishedAt(story) {
  return (
    normalizeSourceTimestamp(story.source_created_at) ??
    normalizeSourceTimestamp(story.posted_at) ??
    normalizeSourceTimestamp(story.published_at) ??
    normalizeSourceTimestamp(story.created_at) ??
    normalizeSourceTimestamp(story.created_utc) ??
    normalizeSourceTimestamp(story.date)
  );
}

async function generateDraft(openai, model, story, index, observability = {}) {
  const promptResult = await getLangfusePrompt(
    observability.langfuse,
    STORY_DRAFT_GENERATION_PROMPT,
    STORY_DRAFT_GENERATION_FALLBACK
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
    "- Set publish_ready to false only if privacy risk or lack of clarity is too high for public posting.",
    "- Use only tags that are directly supported by the source.",
    "- quality_score should be 0 to 100.",
    "",
    JSON.stringify(story)
  ].join("\n");

  const trace = observability.langfuse?.trace({
    id: observability.traceId,
    input: summarizeStorySource(story),
    metadata: {
      source: observability.source,
      source_story_id: story.source_story_id
    },
    name: "community-draft-generation",
    tags: ["story-pipeline", observability.source ?? "unknown"]
  });
  const generation = trace?.generation({
    input: summarizeStorySource(story),
    model,
    name: "openai-draft-generation",
    prompt: promptResult.prompt
  });

  const response = await openai.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: promptResult.text }]
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
  const sourceComments = Array.isArray(story.comments) ? story.comments.map(readString).filter(Boolean) : [];
  const draftComments = sourceComments.length > 0 && Array.isArray(parsed.comments)
    ? parsed.comments
        .map((comment, commentIndex) => {
          const body = normalizeCommentBody(readString(readObject(comment).body));
          return body
            ? {
                author_label: buildAnonymousCommentAuthor(commentIndex, `${story.source_story_id}:comment:${commentIndex + 1}`),
                body
              }
            : null;
        })
        .filter(Boolean)
    : [];
  const fallbackComments = sourceComments.map((body, commentIndex) => ({
    author_label: buildAnonymousCommentAuthor(commentIndex, `${story.source_story_id}:comment:${commentIndex + 1}`),
    body: normalizeCommentBody(body)
  }));
  const comments = draftComments.length > 0 ? draftComments : fallbackComments;

  const publishDraft = {
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

  generation?.end({
    output: {
      comment_count: comments.length,
      moderation_flag_count: publishDraft.moderation_flags.length,
      privacy_flag_count: publishDraft.privacy_flags.length,
      publish_ready: publishDraft.publish_ready,
      quality_score: publishDraft.quality_score,
      tag_count: publishDraft.tags.length
    }
  });

  return publishDraft;
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
  const { communitySpaceId, draft, importItemId, publishedPostId, sourcePublishedAt } = params;
  const sourceDateUpdate = sourcePublishedAt ? { created_at: sourcePublishedAt } : {};

  if (publishedPostId) {
    const { error } = await supabase
      .from("community_posts")
      .update({
        author_label: draft.public_author_label,
        title: draft.title,
        body: draft.body,
        tags: draft.tags,
        space_id: communitySpaceId,
        import_item_id: importItemId,
        ...sourceDateUpdate
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
        space_id: communitySpaceId,
        ...sourceDateUpdate
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
      user_id: null,
      ...sourceDateUpdate
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
        author_label: comment.authorLabel || buildAnonymousCommentAuthor(index, `${itemId}:comment:${index + 1}`),
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
  const source = readString(batch.source);
  if (!source) {
    throw new Error(`Batch file ${batchPath} is missing a "source" field. Set "source": "reddit" or "source": "rednote" in the batch JSON.`);
  }
  const note = readString(batch.note);
  const langfuse = getStoryLangfuseClient();
  const runTraceId = createTraceId();

  trackStoryEvent(langfuse, {
    input: {
      batch_path: batchPath,
      story_count: batch.stories.length
    },
    name: "curated-import.started",
    output: {
      source
    },
    source,
    traceId: runTraceId
  });

  const duplicateIds = await findCrossBatchDuplicates(supabase, batch.stories, source);
  const storiesToImport = batch.stories.filter((story) => !duplicateIds.has(story.source_story_id));
  const skippedDuplicates = batch.stories.filter((story) => duplicateIds.has(story.source_story_id));

  if (skippedDuplicates.length > 0) {
    console.log(`Cross-batch dedup: skipped ${skippedDuplicates.length} duplicate(s): ${skippedDuplicates.map((s) => s.source_story_id).join(", ")}`);
  }

  const generated = [];
  for (let index = 0; index < storiesToImport.length; index += 1) {
    const story = storiesToImport[index];
    const traceId = createTraceId();
    const publishDraft = await generateDraft(openai, model, story, index, {
      langfuse,
      source,
      traceId
    });

    // Send rubric scores to Langfuse if present in batch JSON
    if (story.rubric_scores) {
      const rs = story.rubric_scores;
      scoreRubric(langfuse, {
        traceId,
        base: rs.base_total,
        signal: rs.signal_total,
        commentValue: rs.comment_value,
        total: rs.combined_total,
        tier: rs.tier
      });
    }

    generated.push({
      langfuse_trace_id: traceId,
      source_story_id: story.source_story_id,
      source_payload_private: {
        title: story.title,
        body: story.body,
        date: story.date ?? null,
        source_created_at: getStorySourcePublishedAt(story),
        created_utc: story.created_utc ?? null,
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
      publish_draft: publishDraft,
      observability_metadata: {
        source,
        source_story_id: story.source_story_id,
        source_summary: summarizeStorySource(story),
        trace_id: traceId
      }
    });
  }

  const { data: runRow, error: runInsertError } = await supabase
    .from("community_import_runs")
    .insert({
      langfuse_trace_id: runTraceId,
      observability_metadata: {
        source,
        trace_id: runTraceId,
        transport: "curated_script"
      },
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
    langfuse_trace_id: item.langfuse_trace_id,
    observability_metadata: {
      ...item.observability_metadata,
      run_id: runRow.id
    },
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
            return body
              ? {
                  authorLabel: buildAnonymousCommentAuthor(index, `${item.source_story_id}:comment:${index + 1}`),
                  body
                }
              : null;
          })
          .filter(Boolean)
      : [];

    const sourcePayload = readObject(generated.find((generatedItem) => generatedItem.source_story_id === item.source_story_id)?.source_payload_private);
    const postId = await resolvePublishedPostId(supabase, {
      communitySpaceId,
      draft,
      importItemId: item.id,
      publishedPostId: item.published_post_id,
      sourcePublishedAt: readString(sourcePayload.source_created_at)
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
      notes: note ? `${note} Imported ${generated.length} stories. Auto-approved ${published.length}. Left ${queued.length} in review. Skipped ${skippedDuplicates.length} cross-batch duplicate(s).` : `Imported ${generated.length} stories. Auto-approved ${published.length}. Left ${queued.length} in review. Skipped ${skippedDuplicates.length} cross-batch duplicate(s).`
    })
    .eq("id", runRow.id);

  if (runUpdateError) {
    throw new Error(runUpdateError.message);
  }

  trackStoryEvent(langfuse, {
    name: "curated-import.completed",
    output: {
      auto_approved: published.length,
      imported: generated.length,
      left_in_review: queued.length,
      run_id: runRow.id
    },
    runId: runRow.id,
    source,
    traceId: runTraceId
  });
  await langfuse?.flushAsync();

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
