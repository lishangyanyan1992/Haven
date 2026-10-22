import { HAVEN_VAULT_BUCKET } from "@/lib/document-vault";
import type { SharedAnswers } from "@/lib/firms/answers";
import { compareByUrgency, rankUrgency, type Urgency } from "@/lib/firms/urgency";
import { firmClientStatus, isNewFirmClient } from "@/lib/firms/status";
import type { FirmClientRow, FirmClientStatus } from "@/lib/firms/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * What a lawyer sees about their firm's clients.
 *
 * Every function takes the firmId from requireFirmMember() and filters by it.
 * Documents are looked up only for user ids that came out of a firm_clients
 * query already filtered by that firm. Setup answers come from the firm's own
 * copy (firm_clients.shared_answers), never from user_profiles, which the
 * chat also writes to. Nothing here reads chats or remembered facts.
 */

function admin() {
  return createSupabaseAdminClient() as any;
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
  urgency: Urgency;
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

  const docCounts = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: docRows } = await admin().from("user_documents").select("user_id").in("user_id", userIds);
    for (const d of docRows ?? []) docCounts.set(d.user_id, (docCounts.get(d.user_id) ?? 0) + 1);
  }

  const now = new Date();
  const summaries: FirmClientSummary[] = rows.map((row) => {
    const answers = (row.shared_answers ?? {}) as SharedAnswers;
    const status = firmClientStatus(row, answers);
    const fullName = typeof answers.fullName === "string" ? answers.fullName.trim() : "";
    return {
      id: row.id,
      displayName: fullName || row.normalized_email,
      email: row.normalized_email,
      visaType: typeof answers.visaType === "string" ? answers.visaType : null,
      status,
      isNew: isNewFirmClient(row),
      documentCount: row.user_id ? docCounts.get(row.user_id) ?? 0 : 0,
      joinedAt: row.joined_at,
      createdAt: row.created_at,
      urgency: rankUrgency(answers, now)
    };
  });

  // Most urgent first (tier, then fewest days left, then newest); people who
  // haven't confirmed their email yet go last.
  return summaries.sort((a, b) =>
    compareByUrgency(
      { emailSent: a.status === "email_sent", urgency: a.urgency, createdAt: a.createdAt },
      { emailSent: b.status === "email_sent", urgency: b.urgency, createdAt: b.createdAt }
    )
  );
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
  answers: SharedAnswers;
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

  const answers = (client.shared_answers ?? {}) as SharedAnswers;
  let documents: FirmClientDocument[] = [];
  if (client.user_id) {
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
    status: firmClientStatus(client, answers),
    joinedAt: client.joined_at,
    completedAt: client.completed_at,
    answers,
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
