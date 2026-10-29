import { DAILY_PAGE_CAP } from "@/lib/document-context/read";
import { factSetFor } from "@/lib/document-facts/catalog";
import { extractDocumentFacts, type ExtractorClient } from "@/lib/document-facts/extract";
import { applyDocumentFacts, type ApplyResult } from "@/lib/field-sources/store";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function admin() {
  return createSupabaseAdminClient() as any;
}

/**
 * A document's pages rebuilt from its stored passages, so details can be read
 * (or re-read) without sending the file to the model again. Passages overlap a
 * little; repeated lines don't change what is found.
 */
export function pagesFromChunks(chunks: Array<{ page: number; chunk_index: number; content: string }>) {
  const byPage = new Map<number, string[]>();
  for (const c of [...chunks].sort((a, b) => a.page - b.page || a.chunk_index - b.chunk_index)) {
    byPage.set(c.page, [...(byPage.get(c.page) ?? []), c.content]);
  }
  return [...byPage.entries()].map(([page, parts]) => ({ page, text: parts.join("\n") }));
}

export type DetailsOutcome =
  | { status: "done"; result: ApplyResult }
  | { status: "none" }
  | { status: "not_read" }
  | { status: "deferred" };

/**
 * Read a document's details from its text, replace any earlier ones, and
 * apply them. The document must already be read (its passages stored).
 */
export async function readDocumentDetails(documentId: string, client?: ExtractorClient): Promise<DetailsOutcome> {
  const db = admin();
  const { data: doc } = await db
    .from("user_documents")
    .select("id, user_id, document_kind, reading_status")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc || doc.reading_status !== "done") return { status: "not_read" };

  const { data: chunks } = await db
    .from("document_chunks")
    .select("page, chunk_index, content")
    .eq("document_id", documentId)
    .order("page")
    .order("chunk_index");
  const pages = pagesFromChunks(chunks ?? []);
  if (!factSetFor(doc.document_kind, pages.map((p) => p.text).join("\n"))) return { status: "none" };

  // One extra text-only call, counted as one page against the day's cap.
  const { data: fits, error: capError } = await db.rpc("reserve_document_reading_pages", {
    p_user_id: doc.user_id,
    p_pages: 1,
    p_daily_cap: DAILY_PAGE_CAP
  });
  if (capError) throw new Error(capError.message);
  if (!fits) return { status: "deferred" };

  const { facts } = await extractDocumentFacts({ documentKind: doc.document_kind, pages }, client);

  // Replace, so reading again never leaves old details behind.
  await db.from("document_facts").delete().eq("document_id", documentId);
  if (facts.length > 0) {
    const { error } = await db.from("document_facts").insert(
      facts.map((f) => ({
        user_id: doc.user_id,
        document_id: documentId,
        fact_key: f.key,
        value: f.value,
        raw_text: f.rawText,
        page: f.page,
        confident: f.confident
      }))
    );
    if (error) throw new Error(`Could not save document details: ${error.message}`);
  }
  return { status: "done", result: await applyDocumentFacts(doc.user_id, documentId) };
}

/** Every stored detail for a user's documents, by document id. Server only. */
export async function loadFactsByDocument(userId: string) {
  const { toStoredFact } = await import("@/lib/document-facts/describe");
  const { data, error } = await admin().from("document_facts").select("*").eq("user_id", userId);
  if (error) {
    console.error("[document-facts] could not load", error.message);
    return new Map<string, ReturnType<typeof toStoredFact>[]>();
  }
  const out = new Map<string, ReturnType<typeof toStoredFact>[]>();
  for (const row of data ?? []) {
    const fact = toStoredFact(row);
    out.set(fact.documentId, [...(out.get(fact.documentId) ?? []), fact]);
  }
  return out;
}
