import { HAVEN_VAULT_BUCKET } from "@/lib/document-vault";
import { firmClientStatus, isNewFirmClient } from "@/lib/firms/status";
import type { FirmClientRow, FirmClientStatus } from "@/lib/firms/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * What a lawyer sees about their firm's clients.
 *
 * Every function takes the firmId from requireFirmMember() and filters by it.
 * Client data is looked up only for user ids that came out of a firm_clients
 * query already filtered by that firm. Nothing here reads chats or
 * remembered facts: the dashboard shows setup answers and documents only.
 */

function admin() {
  return createSupabaseAdminClient() as any;
}

const PROFILE_FIELDS =
  "id, full_name, visa_type, country_of_birth, current_visa_expiry_date, h1b_start_date, employer_name, job_title, employer_size, employment_status, perm_stage, perm_filing_date, priority_date, preference_category, i140_approved, i485_filed, spouse_visa_status, primary_goal, top_concerns";

/**
 * Setup doesn't ask for a name, so new accounts get the part of the email
 * before the @ as a placeholder. Show the email instead of that.
 */
export function clientName(fullName: unknown, email: string) {
  const name = typeof fullName === "string" ? fullName.trim() : "";
  if (!name || name.toLowerCase() === email.split("@")[0]) return email;
  return name;
}

export type FirmClientSummary = {
  id: string;
  displayName: string;
  email: string;
  visaType: string | null;
  status: FirmClientStatus;
  isNew: boolean;
  documentCount: number;
  joinedAt: string | null;
  createdAt: string;
};

async function firmClientRows(firmId: string): Promise<FirmClientRow[]> {
  const { data, error } = await admin()
    .from("firm_clients")
    .select("*")
    .eq("firm_id", firmId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load clients: ${error.message}`);
  return (data ?? []) as FirmClientRow[];
}

export async function listFirmClients(firmId: string): Promise<FirmClientSummary[]> {
  const rows = await firmClientRows(firmId);
  const userIds = rows.map((r) => r.user_id).filter((id): id is string => Boolean(id));

  const profiles = new Map<string, any>();
  const docCounts = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: profileRows } = await admin().from("user_profiles").select(PROFILE_FIELDS).in("id", userIds);
    for (const p of profileRows ?? []) profiles.set(p.id, p);

    const { data: docRows } = await admin().from("user_documents").select("user_id").in("user_id", userIds);
    for (const d of docRows ?? []) docCounts.set(d.user_id, (docCounts.get(d.user_id) ?? 0) + 1);
  }

  return rows.map((row) => {
    const profile = row.user_id ? profiles.get(row.user_id) ?? null : null;
    const status = firmClientStatus(row, profile);
    const stepOneSaved = Boolean(profile?.country_of_birth?.trim());
    return {
      id: row.id,
      displayName: clientName(profile?.full_name, row.normalized_email),
      email: row.normalized_email,
      visaType: stepOneSaved ? profile.visa_type : null,
      status,
      isNew: isNewFirmClient(row),
      documentCount: row.user_id ? docCounts.get(row.user_id) ?? 0 : 0,
      joinedAt: row.joined_at,
      createdAt: row.created_at
    };
  });
}

export type FirmClientDocument = {
  id: string;
  name: string;
  kind: string;
  uploadedAt: string;
};

export type FirmClientDetail = {
  id: string;
  email: string;
  status: FirmClientStatus;
  joinedAt: string | null;
  completedAt: string | null;
  profile: Record<string, unknown> | null;
  documents: FirmClientDocument[];
};

/** One client of this firm, or null. Always filters by both ids. */
export async function getFirmClient(firmId: string, firmClientId: string): Promise<FirmClientDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(firmClientId)) return null;
  const { data: row } = await admin()
    .from("firm_clients")
    .select("*")
    .eq("firm_id", firmId)
    .eq("id", firmClientId)
    .maybeSingle();
  if (!row) return null;
  const client = row as FirmClientRow;

  let profile: Record<string, unknown> | null = null;
  let documents: FirmClientDocument[] = [];
  if (client.user_id) {
    const { data: p } = await admin().from("user_profiles").select(PROFILE_FIELDS).eq("id", client.user_id).maybeSingle();
    profile = p ?? null;
    const { data: docs } = await admin()
      .from("user_documents")
      .select("id, original_name, display_label, document_kind, uploaded_at")
      .eq("user_id", client.user_id)
      .order("uploaded_at", { ascending: false });
    documents = (docs ?? []).map((d: any) => ({
      id: d.id,
      name: d.original_name,
      kind: d.display_label || d.document_kind,
      uploadedAt: d.uploaded_at
    }));
  }

  return {
    id: client.id,
    email: client.normalized_email,
    status: firmClientStatus(client, profile as any),
    joinedAt: client.joined_at,
    completedAt: client.completed_at,
    profile,
    documents
  };
}

/** Opening a client clears New for everyone at the firm. */
export async function markFirmClientReviewed(firmId: string, firmClientId: string) {
  await admin()
    .from("firm_clients")
    .update({ reviewed_at: new Date().toISOString() })
    .eq("firm_id", firmId)
    .eq("id", firmClientId)
    .not("completed_at", "is", null)
    .is("reviewed_at", null);
}

export const FIRM_DOCUMENT_LINK_SECONDS = 300;

/**
 * A short-lived link to one document, only if it belongs to a client of this
 * firm. Returns null otherwise, without saying why.
 */
export async function firmDocumentUrl(firmId: string, firmClientId: string, documentId: string): Promise<string | null> {
  const { data: row } = await admin()
    .from("firm_clients")
    .select("user_id")
    .eq("firm_id", firmId)
    .eq("id", firmClientId)
    .maybeSingle();
  if (!row?.user_id) return null;

  const { data: doc } = await admin()
    .from("user_documents")
    .select("storage_path")
    .eq("id", documentId)
    .eq("user_id", row.user_id)
    .maybeSingle();
  if (!doc?.storage_path) return null;

  const { data, error } = await admin()
    .storage.from(HAVEN_VAULT_BUCKET)
    .createSignedUrl(doc.storage_path, FIRM_DOCUMENT_LINK_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl as string;
}
