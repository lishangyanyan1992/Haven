import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getDefaultRequiredDocuments, validateRequiredDocumentList } from "@/lib/document-vault";
import type { RequiredDocumentItem } from "@/lib/firms/types";

function admin() {
  return createSupabaseAdminClient() as any;
}

/**
 * Returns the firm's configured required documents list, or the default
 * preset required documents when the lawyer has not customized them yet.
 */
export async function getFirmRequiredDocuments(firmId: string): Promise<RequiredDocumentItem[]> {
  const { data, error } = await admin()
    .from("firms")
    .select("required_documents")
    .eq("id", firmId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load firm required documents: ${error.message}`);
  }

  const list = data?.required_documents;
  if (!Array.isArray(list) || list.length === 0) {
    return getDefaultRequiredDocuments();
  }
  return list as RequiredDocumentItem[];
}

/**
 * Validates and saves the firm's required documents list.
 * Scoped strictly to the provided firmId.
 */
export async function saveFirmRequiredDocuments(
  firmId: string,
  rawItems: unknown
): Promise<RequiredDocumentItem[]> {
  const validation = validateRequiredDocumentList(rawItems);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const { error } = await admin()
    .from("firms")
    .update({ required_documents: validation.items })
    .eq("id", firmId);

  if (error) {
    throw new Error(`Could not save firm required documents: ${error.message}`);
  }

  return validation.items;
}
