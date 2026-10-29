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

/**
 * Unions required document lists across multiple connected law firms.
 * Deduplicates shared preset documents by key, and deduplicates custom documents
 * when both key and normalized label match. If two firms define different custom
 * documents whose slug keys collide, assigns a firm-scoped key to keep them distinct.
 *
 * @param firmLists - Array of firm IDs with their respective required document lists
 * @returns Deduplicated and collision-disambiguated list of required documents
 */
export function unionRequiredDocuments(
  firmLists: Array<{ firmId: string; docs: RequiredDocumentItem[] }>
): RequiredDocumentItem[] {
  const seenIdentities = new Set<string>();
  const unioned: RequiredDocumentItem[] = [];

  for (const { firmId, docs } of firmLists) {
    for (const d of docs) {
      const docIdentity = d.isCustom ? `${d.key}:${d.label.toLowerCase().trim()}` : d.key;
      if (seenIdentities.has(docIdentity)) {
        // Same document from two firms: ask per sponsor if either firm does.
        const existing = unioned.find((u) => (u.isCustom ? `${u.key}:${u.label.toLowerCase().trim()}` : u.key) === docIdentity);
        if (existing && d.perSponsor && !existing.perSponsor) {
          unioned[unioned.indexOf(existing)] = { ...existing, perSponsor: true };
        }
      } else {
        seenIdentities.add(docIdentity);
        let finalItem = d;
        if (d.isCustom && unioned.some((existing) => existing.key === d.key && existing.label !== d.label)) {
          finalItem = { ...d, key: `${d.key}_${firmId.slice(0, 8)}` };
        }
        unioned.push(finalItem);
      }
    }
  }

  return unioned;
}

/**
 * Checks whether an uploaded document kind matches a firm requirement key,
 * resolving both direct keys and collision-suffixed keys.
 *
 * @param uploadedDocKind - The document_kind from user_documents
 * @param requirementKey - The configured requirement key from the firm
 * @param firmId - Optional firm ID to check collision suffix
 * @returns True if the document fulfills the requirement
 */
export function documentKindMatchesRequirement(
  uploadedDocKind: string,
  requirementKey: string,
  firmId?: string
): boolean {
  if (uploadedDocKind === requirementKey) return true;
  if (firmId && uploadedDocKind === `${requirementKey}_${firmId.slice(0, 8)}`) return true;
  return false;
}
