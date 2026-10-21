/**
 * Database side of document context: the reading queue and the per-question
 * search. Runs with the admin client because the reader works when nobody is
 * signed in, so every query is scoped by user_id by hand.
 */

import { env } from "@/lib/env";
import { HAVEN_VAULT_BUCKET } from "@/lib/document-vault";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DAILY_PAGE_CAP,
  DOCUMENT_EMBEDDING_MODEL,
  asPgVector,
  countPages,
  embedPassages,
  openaiClient,
  readDocument
} from "@/lib/document-context/read";

function admin() {
  return createSupabaseAdminClient();
}

/** The test switch. Off for everyone unless DOCUMENT_READING_ALLOWLIST names them. */
export function documentContextAvailableFor(email: string | null | undefined) {
  const list = (env.DOCUMENT_READING_ALLOWLIST ?? "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (list.includes("*")) return true;
  return Boolean(email) && list.includes(String(email).toLowerCase());
}

// ── Queue ─────────────────────────────────────────────────────────────────────

/** Mark one of the user's documents to be read. Returns false if it isn't theirs. */
export async function queueDocument(userId: string, documentId: string) {
  const { data } = await admin()
    .from("user_documents")
    .update({ reading_status: "pending", reading_error: null })
    .eq("id", documentId)
    .eq("user_id", userId)
    .in("reading_status", ["not_requested", "failed"])
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

export type ReadOutcome = "done" | "failed" | "deferred" | "skipped";

/**
 * Read one queued document. Safe to call twice: it claims the document first,
 * and a document already claimed is skipped.
 */
export async function readQueuedDocument(documentId: string): Promise<ReadOutcome> {
  const db = admin();

  const { data: claimed } = await db
    .from("user_documents")
    .update({ reading_status: "reading", reading_started_at: new Date().toISOString() })
    .eq("id", documentId)
    .in("reading_status", ["pending", "deferred"])
    .select("id, user_id, storage_path, original_name, mime_type")
    .maybeSingle();
  if (!claimed) return "skipped";

  const finish = async (status: "done" | "failed" | "deferred" | "pending", extra: Record<string, unknown> = {}) => {
    await db.from("user_documents").update({ reading_status: status, ...extra }).eq("id", documentId);
  };

  const { data: file, error: downloadError } = await db.storage.from(HAVEN_VAULT_BUCKET).download(claimed.storage_path);
  if (downloadError || !file) {
    await finish("failed", { reading_error: "Haven couldn't open this file. Try uploading it again." });
    return "failed";
  }

  const input = { fileName: claimed.original_name, mimeType: claimed.mime_type, bytes: Buffer.from(await file.arrayBuffer()) };
  const pages = countPages(input);

  const { data: fits, error: capError } = await db.rpc("reserve_document_reading_pages", {
    p_user_id: claimed.user_id,
    p_pages: pages,
    p_daily_cap: DAILY_PAGE_CAP
  });
  if (capError) {
    await finish("pending");
    throw new Error(capError.message);
  }
  if (!fits) {
    await finish("deferred", { page_count: pages });
    return "deferred";
  }

  try {
    const result = await readDocument(input);
    if (!result.ok) {
      await finish("failed", { reading_error: result.reason, page_count: pages, read_at: new Date().toISOString() });
      return "failed";
    }

    const embeddings = await embedPassages(result.passages.map((p) => p.content));

    // Replace, so reading a document again never leaves duplicates behind.
    await db.from("document_chunks").delete().eq("document_id", documentId);
    const { error: insertError } = await db.from("document_chunks").insert(
      result.passages.map((p, i) => ({
        user_id: claimed.user_id,
        document_id: documentId,
        page: p.page,
        chunk_index: p.chunkIndex,
        content: p.content,
        embedding: asPgVector(embeddings[i]),
        model: DOCUMENT_EMBEDDING_MODEL
      }))
    );
    if (insertError) throw new Error(insertError.message);
  } catch (error) {
    // A provider or database hiccup is not the document's fault: try again later.
    await finish("pending", { page_count: pages });
    throw error;
  }

  await finish("done", { reading_error: null, page_count: pages, read_at: new Date().toISOString() });
  return "done";
}

/** Older than this in "reading" means the worker died mid-read. */
const STALE_READING_MS = 15 * 60 * 1000;

/** One pass of the background reader. */
export async function processReadingQueue(limit = 20) {
  const db = admin();
  await db
    .from("user_documents")
    .update({ reading_status: "pending" })
    .eq("reading_status", "reading")
    .lt("reading_started_at", new Date(Date.now() - STALE_READING_MS).toISOString());

  const { data: queued, error } = await db
    .from("user_documents")
    .select("id")
    .in("reading_status", ["pending", "deferred"])
    .order("uploaded_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const outcomes: Record<ReadOutcome | "error", number> = { done: 0, failed: 0, deferred: 0, skipped: 0, error: 0 };
  for (const row of queued ?? []) {
    try {
      outcomes[await readQueuedDocument(row.id)] += 1;
    } catch {
      outcomes.error += 1;
    }
  }
  return outcomes;
}

// ── Search, for the chat ──────────────────────────────────────────────────────

export interface DocumentPassage {
  documentLabel: string;
  page: number;
  content: string;
  similarity: number;
}

export const DOCUMENT_PASSAGE_LIMIT = 5;

/**
 * How close a passage has to be for a question that named no topic to count as
 * understood. Measured on a real I-94: "until what date can I stay?" scored
 * 0.44, an unrelated visa bulletin question 0.37, a gym refund nothing at all.
 */
export const DOCUMENT_MATCH_SIMILARITY = 0.4;

/** The vault's fallback label, which says nothing a citation can use. */
const GENERIC_LABEL = "Immigration document";

/**
 * The passages from this user's documents most related to the question. Empty
 * when they have no read documents, without spending an embedding call.
 */
export async function searchUserDocuments(userId: string, question: string): Promise<DocumentPassage[]> {
  const db = admin();
  const { count } = await db.from("document_chunks").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (!count) return [];

  const openai = openaiClient();
  if (!openai) return [];
  const response = await openai.embeddings.create({ model: DOCUMENT_EMBEDDING_MODEL, input: question });
  const embedding = response.data[0]?.embedding;
  if (!embedding) return [];

  const { data, error } = await db.rpc("match_document_chunks", {
    p_user_id: userId,
    query_embedding: asPgVector(embedding),
    match_count: DOCUMENT_PASSAGE_LIMIT
  });
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  // A generic label cites nothing useful ("your Immigration document"), so fall
  // back to the file name the user gave it.
  const genericIds = [...new Set(rows.filter((r) => r.document_label === GENERIC_LABEL).map((r) => r.document_id))];
  const names = new Map<string, string>();
  if (genericIds.length > 0) {
    const { data: docs } = await db.from("user_documents").select("id, original_name").eq("user_id", userId).in("id", genericIds);
    for (const d of docs ?? []) names.set(d.id, d.original_name);
  }

  return rows.map((row) => ({
    documentLabel: names.get(row.document_id) ?? row.document_label,
    page: row.page,
    content: row.content,
    similarity: row.similarity
  }));
}

/** The prompt block's lines: each passage with the document and page to cite. */
export function renderPassagesForPrompt(passages: Array<Pick<DocumentPassage, "documentLabel" | "page" | "content">>): string[] {
  return passages.map((p) => `[${p.documentLabel}, page ${p.page}]\n${p.content}`);
}
