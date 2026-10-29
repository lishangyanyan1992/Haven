"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { HAVEN_VAULT_BUCKET } from "@/lib/document-vault";
import { ownPetitionId } from "@/lib/document-sponsor-link";
import { forgetDeletedDocument } from "@/lib/field-sources/person";

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

  // Values this document filled stay, labeled "From a document you deleted — please confirm".
  await forgetDeletedDocument(user.id, document.id);
  const { error: deleteError } = await admin.from("user_documents").delete().eq("id", document.id).eq("user_id", user.id);
  if (deleteError) {
    throw new Error(deleteError.message);
  }

  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  revalidatePath("/planner");
  revalidatePath("/documents");
}

export async function updateVaultDocumentAction(formData: FormData) {
  const user = await requireUser();
  const documentId = String(formData.get("documentId") ?? "").trim();
  const displayLabel = String(formData.get("displayLabel") ?? "").trim();
  const documentKind = String(formData.get("documentKind") ?? "").trim();

  if (!documentId) {
    throw new Error("Missing document ID.");
  }
  if (!displayLabel) {
    throw new Error("Document label cannot be empty.");
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("user_documents")
    .update({
      display_label: displayLabel,
      ...(documentKind ? { document_kind: documentKind } : {})
    })
    .eq("id", documentId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/documents");
  revalidatePath("/inbox");
  revalidatePath("/firm");
}

/** Links a sponsor document to one of the user's green cards, or clears the link. */
export async function setDocumentSponsorAction(formData: FormData) {
  const user = await requireUser();
  const documentId = String(formData.get("documentId") ?? "").trim();
  if (!documentId) throw new Error("Missing document ID.");
  const raw = String(formData.get("petitionId") ?? "").trim();
  const petitionId = await ownPetitionId(user.id, raw);
  if (raw && !petitionId) throw new Error("That green card isn't on your account.");

  const { error } = await createSupabaseAdminClient()
    .from("user_documents")
    .update({ petition_id: petitionId })
    .eq("id", documentId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  revalidatePath("/firm");
}
