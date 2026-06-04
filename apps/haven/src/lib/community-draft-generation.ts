import crypto from "node:crypto";

import OpenAI from "openai";

import { buildAnonymousCommentAuthor } from "@/lib/community-imports";
import { env } from "@/lib/env";
import { flushLangfuse, getOrCreatePrompt, getStoryLangfuseClient } from "@/lib/langfuse";
import { summarizeStorySource, trackStoryEvent } from "@/lib/story-observability";
import type { Json } from "@/types/database";

const LEGAL_CAVEAT = "Community experience only, not legal advice.";
const STORY_DRAFT_GENERATION_PROMPT = "haven-story-draft-generation";
const STORY_DRAFT_GENERATION_FALLBACK =
  "You transform immigration forum stories into anonymized review drafts for a public community forum.";

type GenerateCommunityDraftParams = {
  language?: string | null;
  runId: string;
  source: string;
  sourcePayloadPrivate: Json;
  sourceStoryId: string;
  traceId: string;
};

function readObject(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean)
    : [];
}

function normalizeBody(body: string) {
  return body
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildPublicAuthorLabel(seed: string) {
  const digest = crypto.createHash("sha256").update(seed).digest("hex");
  const numeric = Number.parseInt(digest.slice(0, 8), 16) % 1000;
  return `Haven_User_${String(numeric).padStart(3, "0")}`;
}

function sourcePayloadToPromptInput(params: GenerateCommunityDraftParams) {
  const source = readObject(params.sourcePayloadPrivate);
  const comments = Array.isArray(source.comments)
    ? source.comments
        .map((comment) => {
          const record = readObject(comment);
          return readString(record.body_translated) || readString(record.body);
        })
        .filter(Boolean)
    : [];

  return {
    body: readString(source.body),
    case_brief: readObject(source.case_brief),
    comments,
    language: params.language ?? null,
    source: params.source,
    source_story_id: params.sourceStoryId,
    source_url: readString(source.source_url),
    title: readString(source.title)
  };
}

export function canGenerateCommunityDraft() {
  return Boolean(env.OPENAI_API_KEY);
}

export async function generateCommunityDraft(params: GenerateCommunityDraftParams) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to generate community import drafts.");
  }

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const langfuse = getStoryLangfuseClient();
  const model = env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";
  const promptResult = await getOrCreatePrompt(langfuse, STORY_DRAFT_GENERATION_PROMPT, STORY_DRAFT_GENERATION_FALLBACK);
  const sourceSummary = summarizeStorySource(params.sourcePayloadPrivate);
  const promptInput = sourcePayloadToPromptInput(params);

  trackStoryEvent({
    input: sourceSummary,
    name: "community-import-api.draft-generation.started",
    runId: params.runId,
    source: params.source,
    sourceStoryId: params.sourceStoryId,
    traceId: params.traceId
  });

  const trace = langfuse?.trace({
    id: params.traceId,
    input: sourceSummary,
    metadata: {
      language: params.language ?? undefined,
      runId: params.runId,
      source: params.source,
      sourceStoryId: params.sourceStoryId
    },
    name: "community-draft-generation",
    sessionId: params.runId,
    tags: ["story-pipeline", params.source]
  });
  const generation = trace?.generation({
    input: sourceSummary,
    model,
    name: "openai-community-draft-generation",
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
        content: [
          {
            type: "input_text",
            text: [
              "Create a safe public forum draft from this private immigration community source story.",
              "Requirements:",
              "- Keep the post in first person.",
              "- Preserve key immigration facts, timeline logic, and practical outcome.",
              "- Make it less identifiable than the source. Do not copy source phrasing.",
              "- Do not mention source platforms, usernames, employers, or links.",
              "- Rewrite comments into useful non-verbatim community replies.",
              "- Use calm, practical forum language.",
              "- Set publish_ready to false if privacy risk or lack of clarity is too high.",
              "- Use only tags directly supported by the source.",
              "- quality_score should be 0 to 100.",
              "",
              JSON.stringify(promptInput)
            ].join("\n")
          }
        ]
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
            actions_taken: { type: "array", items: { type: "string" } },
            body: { type: "string" },
            comment_insights: { type: "array", items: { type: "string" } },
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
            community_takeaways: { type: "array", items: { type: "string" } },
            moderation_flags: { type: "array", items: { type: "string" } },
            outcome_summary: { type: "string" },
            privacy_flags: { type: "array", items: { type: "string" } },
            publish_ready: { type: "boolean" },
            quality_score: { type: "number" },
            risk_notes: { type: "array", items: { type: "string" } },
            situation_summary: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            title: { type: "string" }
          }
        }
      }
    }
  });

  const parsed = JSON.parse(response.output_text ?? "{}") as Record<string, unknown>;
  const comments = Array.isArray(parsed.comments)
    ? parsed.comments
        .map((comment, index) => {
          const body = normalizeBody(readString(readObject(comment).body));
          return body ? { author_label: buildAnonymousCommentAuthor(index), body } : null;
        })
        .filter(Boolean)
    : [];

  const publishDraft = {
    version: 1,
    public_author_label: buildPublicAuthorLabel(params.sourceStoryId),
    title: readString(parsed.title),
    body: normalizeBody(readString(parsed.body)),
    situation_summary: readString(parsed.situation_summary),
    actions_taken: readStringArray(parsed.actions_taken),
    outcome_summary: readString(parsed.outcome_summary),
    community_takeaways: readStringArray(parsed.community_takeaways),
    comment_insights: readStringArray(parsed.comment_insights),
    risk_notes: readStringArray(parsed.risk_notes),
    legal_caveat: LEGAL_CAVEAT,
    tags: readStringArray(parsed.tags),
    comments,
    tone: "calm_practical",
    quality_score: typeof parsed.quality_score === "number" ? parsed.quality_score : 70,
    privacy_flags: readStringArray(parsed.privacy_flags),
    moderation_flags: readStringArray(parsed.moderation_flags),
    publish_ready: Boolean(parsed.publish_ready)
  };

  generation?.end({
    output: {
      comment_count: publishDraft.comments.length,
      moderation_flag_count: publishDraft.moderation_flags.length,
      privacy_flag_count: publishDraft.privacy_flags.length,
      publish_ready: publishDraft.publish_ready,
      quality_score: publishDraft.quality_score,
      tag_count: publishDraft.tags.length
    }
  });

  trackStoryEvent({
    name: "community-import-api.draft-generation.completed",
    output: {
      comment_count: publishDraft.comments.length,
      publish_ready: publishDraft.publish_ready,
      quality_score: publishDraft.quality_score
    },
    runId: params.runId,
    source: params.source,
    sourceStoryId: params.sourceStoryId,
    traceId: params.traceId
  });
  await flushLangfuse();

  return publishDraft;
}
