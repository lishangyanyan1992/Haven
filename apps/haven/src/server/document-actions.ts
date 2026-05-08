"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HAVEN_VAULT_BUCKET } from "@/lib/document-vault";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}

export async function deleteVaultDocument(formData: FormData) {
  const user = await requireUser();
  const documentId = String(formData.get("documentId") ?? "").trim();

  if (!documentId) {
    throw new Error("Missing document ID.");
  }

  const admin = createSupabaseAdminClient();

  const { data: document, error: documentError } = await admin
    .from("user_documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (documentError) {
    throw new Error(documentError.message);
  }

  if (!document) {
    throw new Error("Document not found.");
  }

  const { error: storageError } = await admin.storage.from(HAVEN_VAULT_BUCKET).remove([document.storage_path]);
  if (storageError) {
    throw new Error(storageError.message);
  }

  const { error: deleteError } = await admin.from("user_documents").delete().eq("id", document.id).eq("user_id", user.id);
  if (deleteError) {
    throw new Error(deleteError.message);
  }

  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  revalidatePath("/planner");
}
