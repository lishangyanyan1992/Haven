import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const publishDraftSchema = z.object({
  version: z.number().int(),
  public_author_label: z.string().min(1),
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
  publish_draft: publishDraftSchema
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

    const rowsToUpsert: CommunityImportInsert[] = uniqueItems.map((item) => ({
        run_id: runRow.id,
        source,
        source_story_id: item.source_story_id,
        language: item.language ?? null,
        source_payload_private: item.source_payload_private as Json,
        publish_draft: item.publish_draft as Json,
        moderation_status: item.publish_draft.publish_ready ? "pending" : "needs_revision"
      }));

    const { error: upsertError } = await admin.from("community_import_items").upsert(rowsToUpsert, {
      onConflict: "source,source_story_id"
    });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

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

    return NextResponse.json({
      source,
      received: parsedBody.items.length,
      inserted: insertedCount,
      updated: updatedCount,
      duplicates: duplicateCount,
      runId: runRow.id
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import community items." },
      { status: 500 }
    );
  }
}
