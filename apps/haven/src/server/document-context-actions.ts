"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { documentContextAvailableFor, queueDocument, readQueuedDocument } from "@/lib/document-context/store";
import { readDocumentDetails } from "@/lib/document-facts/run";

/** "Read it" on a document uploaded before reading existed, or one that failed. */
export async function readDocumentAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");
  if (!(await documentContextAvailableFor(user.email))) throw new Error("Not available.");

  const documentId = String(formData.get("documentId") ?? "").trim();
  if (!documentId) throw new Error("Missing document ID.");

  if (await queueDocument(user.id, documentId)) {
    after(async () => {
      try {
        await readQueuedDocument(documentId);
      } catch (error) {
        console.error("[documents] read error:", error);
      } finally {
        revalidatePath("/documents");
      }
    });
  }
  revalidatePath("/documents");
}

/** "Read details" on a document that was read before details were taken, or to read them again. */
export async function readDocumentDetailsAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");
  if (!(await documentContextAvailableFor(user.email))) throw new Error("Not available.");

  const documentId = String(formData.get("documentId") ?? "").trim();
  if (!documentId) throw new Error("Missing document ID.");
  // Only the owner's own document; the reader re-checks by id.
  const { data: doc } = await supabase.from("user_documents").select("id").eq("id", documentId).eq("user_id", user.id).maybeSingle();
  if (!doc) throw new Error("Document not found.");

  after(async () => {
    try {
      await readDocumentDetails(documentId);
    } catch (error) {
      console.error("[documents] read details error:", error);
    } finally {
      revalidatePath("/documents");
    }
  });
  revalidatePath("/documents");
}
