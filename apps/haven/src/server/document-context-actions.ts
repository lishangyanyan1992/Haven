"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { documentContextAvailableFor, queueDocument, readQueuedDocument } from "@/lib/document-context/store";

/** "Read it" on a document uploaded before reading existed, or one that failed. */
export async function readDocumentAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");
  if (!documentContextAvailableFor(user.email)) throw new Error("Not available.");

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
