import { NextResponse } from "next/server";
import { z } from "zod";

import { canGenerateCommunityDraft, generateCommunityDraft } from "@/lib/community-draft-generation";
import { env } from "@/lib/env";
import { flushLangfuse } from "@/lib/langfuse";
import {
  buildStoryObservabilityMetadata,
  createStoryTraceId,
  trackStoryEvent
} from "@/lib/story-observability";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const publishDraftSchema = z.object({
  version: z.number().int(),
  public_author_label: z.string().min(1),
  public_author_key: z.string().min(1).optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  situation_summary: z.string().min(1),
  actions_taken: z.array(z.string()),
  outcome_summary: z.string().min(1),
  community_takeaways: z.array(z.string()),
  comment_insights: z.array(z.string()),
  risk_notes: z.array(z.string()),
  legal_caveat: z.string().min(1),
  tags: z.array(z.string()),
  comments: z
    .array(
      z.union([
        z.string().min(1),
        z.object({
          author_label: z.string().min(1).optional(),
          author_key: z.string().min(1).optional(),
          body: z.string().min(1)
        })
      ])
    )
    .optional(),
  tone: z.literal("calm_practical"),
  quality_score: z.number(),
  privacy_flags: z.array(z.string()),
  moderation_flags: z.array(z.string()),
  publish_ready: z.boolean()
});

const importItemSchema = z.object({
  source_story_id: z.string().min(1),
  language: z.string().min(1).optional(),
  source_payload_private: z.record(z.string(), z.unknown()),
  publish_draft: publishDraftSchema.optional()
});

const importRequestSchema = z.object({
  source: z.string().min(1),
  items: z.array(importItemSchema).min(1).max(100)
});

type CommunityImportInsert = Database["public"]["Tables"]["community_import_items"]["Insert"];

export async function POST(request: Request) {
  const expectedSecret = env.COMMUNITY_IMPORT_SECRET;

  if (!expectedSecret) {
    return NextResponse.json({ error: "endpoint_not_configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsedBody: z.infer<typeof importRequestSchema>;

  try {
    parsedBody = importRequestSchema.parse(await request.json());
  } catch (error) {
    trackStoryEvent({
      name: "community-import-api.validation-error",
      output: {
        error: error instanceof Error ? error.message : "Request body did not match the expected schema."
      },
      source: "unknown",
      traceId: createStoryTraceId()
    });
    await flushLangfuse();
    return NextResponse.json(
      {
        error: "invalid_payload",
        message: error instanceof Error ? error.message : "Request body did not match the expected schema."
      },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { source } = parsedBody;
  const now = new Date().toISOString();
  const runTraceId = createStoryTraceId();
  const needsDraftGeneration = parsedBody.items.some((item) => !item.publish_draft);

  if (needsDraftGeneration && !canGenerateCommunityDraft()) {
    trackStoryEvent({
      input: {
        item_count: parsedBody.items.length,
        source
      },
      name: "community-import-api.generation-unavailable",
      output: {
        error: "OPENAI_API_KEY is required for source-only imports."
      },
      source,
      traceId: runTraceId
    });
    await flushLangfuse();
    return NextResponse.json(
      {
        error: "endpoint_not_configured_for_generation",
        message: "OPENAI_API_KEY is required for source-only community imports."
      },
      { status: 503 }
    );
  }

  trackStoryEvent({
    input: {
      item_count: parsedBody.items.length,
      source
    },
    name: "community-import-api.received",
    output: {
      received: parsedBody.items.length
    },
    runId: null,
    source,
    traceId: runTraceId
  });

  const dedupedItems = new Map<string, z.infer<typeof importItemSchema>>();
  let duplicateCount = 0;

  for (const item of parsedBody.items) {
    const key = `${source}:${item.source_story_id}`;
    if (dedupedItems.has(key)) {
      duplicateCount += 1;
      continue;
    }
    dedupedItems.set(key, item);
  }

  const uniqueItems = [...dedupedItems.values()];

  try {
    const { data: runRow, error: runInsertError } = await admin
      .from("community_import_runs")
      .insert({
        langfuse_trace_id: runTraceId,
        observability_metadata: {
          source,
          trace_id: runTraceId,
          transport: "internal_api"
        },
        source,
        status: "received",
        item_count: parsedBody.items.length,
        duplicate_count: duplicateCount
      })
      .select("id")
      .single();

    if (runInsertError || !runRow) {
      throw new Error(runInsertError?.message ?? "Unable to create import run.");
    }

    const sourceStoryIds = uniqueItems.map((item) => item.source_story_id);
    const { data: existingRows, error: existingError } = await admin
      .from("community_import_items")
      .select("source_story_id")
      .eq("source", source)
      .in("source_story_id", sourceStoryIds);

    if (existingError) {
      throw new Error(existingError.message);
    }

    const existingIds = new Set((existingRows ?? []).map((row) => row.source_story_id));
    const insertedCount = uniqueItems.filter((item) => !existingIds.has(item.source_story_id)).length;
    const updatedCount = uniqueItems.length - insertedCount;

    const preparedItems = await Promise.all(
      uniqueItems.map(async (item) => {
        const itemTraceId = createStoryTraceId();
        const publishDraft = item.publish_draft ?? (await generateCommunityDraft({
          language: item.language ?? null,
          runId: runRow.id,
          source,
          sourcePayloadPrivate: item.source_payload_private as Json,
          sourceStoryId: item.source_story_id,
          traceId: itemTraceId
        }));

        const parsedPublishDraft = publishDraftSchema.parse(publishDraft);

        return {
          item,
          itemTraceId,
          publishDraft: parsedPublishDraft
        };
      })
    );

    const rowsToUpsert: CommunityImportInsert[] = preparedItems.map(({ item, itemTraceId, publishDraft }) => {
      return {
        langfuse_trace_id: itemTraceId,
        observability_metadata: buildStoryObservabilityMetadata({
          language: item.language ?? null,
          moderationStatus: publishDraft.publish_ready ? "pending" : "needs_revision",
          publishReady: publishDraft.publish_ready,
          runId: runRow.id,
          source,
          sourcePayloadPrivate: item.source_payload_private as Json,
          sourceStoryId: item.source_story_id,
          traceId: itemTraceId
        }) as Json,
        run_id: runRow.id,
        source,
        source_story_id: item.source_story_id,
        language: item.language ?? null,
        source_payload_private: item.source_payload_private as Json,
        publish_draft: publishDraft as Json,
        moderation_status: publishDraft.publish_ready ? "pending" : "needs_revision"
      };
    });

    const { error: upsertError } = await admin.from("community_import_items").upsert(rowsToUpsert, {
      onConflict: "source,source_story_id"
    });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    trackStoryEvent({
      input: {
        unique_count: uniqueItems.length
      },
      name: "community-import-api.items-staged",
      output: {
        staged: rowsToUpsert.length
      },
      runId: runRow.id,
      source,
      traceId: runTraceId
    });

    trackStoryEvent({
      input: {
        duplicate_count: duplicateCount,
        unique_count: uniqueItems.length
      },
      name: "community-import-api.upserted",
      output: {
        inserted: insertedCount,
        updated: updatedCount
      },
      runId: runRow.id,
      source,
      traceId: runTraceId
    });

    const { error: runUpdateError } = await admin
      .from("community_import_runs")
      .update({
        status: "completed",
        inserted_count: insertedCount,
        updated_count: updatedCount,
        duplicate_count: duplicateCount,
        finished_at: now
      })
      .eq("id", runRow.id);

    if (runUpdateError) {
      throw new Error(runUpdateError.message);
    }

    await flushLangfuse();
    return NextResponse.json({
      source,
      received: parsedBody.items.length,
      inserted: insertedCount,
      updated: updatedCount,
      duplicates: duplicateCount,
      runId: runRow.id
    });
  } catch (error) {
    trackStoryEvent({
      name: "community-import-api.error",
      output: {
        error: error instanceof Error ? error.message : "Unable to import community items."
      },
      source,
      traceId: runTraceId
    });
    await flushLangfuse();
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import community items." },
      { status: 500 }
    );
  }
}
