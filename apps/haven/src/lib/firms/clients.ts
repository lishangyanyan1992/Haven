import { HAVEN_VAULT_BUCKET } from "@/lib/document-vault";
import type { SharedAnswers } from "@/lib/firms/answers";
import { cleanEngagementState } from "@/lib/firms/engagement";
import { getFirmRequiredDocuments } from "@/lib/firms/required-documents";
import { compareByUrgency, rankUrgency, type Urgency } from "@/lib/firms/urgency";
import { firmClientStatus, isNewFirmClient } from "@/lib/firms/status";
import type { FirmClientEngagementState, FirmClientRow, FirmClientStatus, FirmPipelineStatus } from "@/lib/firms/types";
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

/**
 * A client asking, from the advisor, to be contacted (specs/firm-contact-requests).
 * Holds only what the client saw and chose to send: the practice area, their
 * dates and the suggested questions. Nothing links it back to a conversation.
 */
export type FirmContactRequest = {
  id: string;
  sentAt: string;
  practiceArea: string;
  dates: string[];
  questions: string[];
};

export type FirmClientSummary = {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  fullName: string | null;
  pipelineStatus: FirmPipelineStatus;
  visaType: string | null;
  status: FirmClientStatus;
  isNew: boolean;
  documentCount: number;
  requiredDocumentCount?: number;
  totalRequiredCount?: number;
  joinedAt: string | null;
  createdAt: string;
  urgency: Urgency;
  /** Shown beside the urgency, never part of it: asking does not move anyone up the list. */
  openContactRequest: { id: string; sentAt: string } | null;
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

function toContactRequest(row: any): FirmContactRequest {
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  return {
    id: row.id,
    sentAt: row.created_at,
    practiceArea: row.practice_area,
    dates: strings(row.dates),
    questions: strings(row.questions)
  };
}

/**
 * This firm's open contact requests, by firm client id.
 *
 * A failure reads as "none open" rather than taking the dashboard down: the
 * marker is an addition to the list, and losing it for a moment is better than
 * losing the list.
 */
async function openContactRequests(firmId: string): Promise<Map<string, FirmContactRequest>> {
  const { data, error } = await admin()
    .from("firm_contact_requests")
    .select("id, firm_client_id, practice_area, dates, questions, created_at")
    .eq("firm_id", firmId)
    .is("handled_at", null);
  if (error) {
    console.error("[firm] could not load contact requests", error.message);
    return new Map();
  }
  return new Map((data ?? []).map((row: any) => [row.firm_client_id as string, toContactRequest(row)]));
}

export async function listFirmClients(firmId: string): Promise<FirmClientSummary[]> {
  const [rows, requiredDocs, contactRequests] = await Promise.all([
    firmClientRows(firmId),
    getFirmRequiredDocuments(firmId),
    openContactRequests(firmId)
  ]);
  const userIds = rows.map((r) => r.user_id).filter((id): id is string => Boolean(id));

  const docCounts = new Map<string, number>();
  const userDocKinds = new Map<string, Set<string>>();

  if (userIds.length > 0) {
    const { data: docRows } = await admin()
      .from("user_documents")
      .select("user_id, document_kind")
      .in("user_id", userIds);
    for (const d of docRows ?? []) {
      docCounts.set(d.user_id, (docCounts.get(d.user_id) ?? 0) + 1);
      if (!userDocKinds.has(d.user_id)) {
        userDocKinds.set(d.user_id, new Set<string>());
      }
      userDocKinds.get(d.user_id)!.add(d.document_kind);
    }
  }

  const totalRequired = requiredDocs?.length ?? 0;
  const now = new Date();
  const summaries: FirmClientSummary[] = rows.map((row) => {
    const answersRecord = (row.shared_answers ?? {}) as Record<string, unknown>;
    const answers = (row.shared_answers ?? {}) as SharedAnswers;
    const status = firmClientStatus(row, answers);
    const resolvedName = (typeof row.full_name === "string" && row.full_name.trim()) ||
      (typeof answers.fullName === "string" ? answers.fullName.trim() : "");
    const rawPhone = answersRecord.phone ?? answersRecord.phoneNumber;
    const resolvedPhone = row.phone ?? (typeof rawPhone === "string" ? rawPhone.trim() : null);

    let requiredDocumentCount: number | undefined;
    if (totalRequired > 0) {
      const kinds = row.user_id ? userDocKinds.get(row.user_id) : undefined;
      let count = 0;
      if (kinds) {
        for (const req of requiredDocs ?? []) {
          if (kinds.has(req.key)) count += 1;
        }
      }
      requiredDocumentCount = count;
    }

    return {
      id: row.id,
      displayName: resolvedName || row.normalized_email,
      fullName: resolvedName || null,
      email: row.normalized_email,
      phone: resolvedPhone || null,
      pipelineStatus: row.pipeline_status ?? "new_lead",
      visaType: typeof answers.visaType === "string" ? answers.visaType : null,
      status,
      isNew: isNewFirmClient(row),
      documentCount: row.user_id ? docCounts.get(row.user_id) ?? 0 : 0,
      requiredDocumentCount,
      totalRequiredCount: totalRequired > 0 ? totalRequired : undefined,
      joinedAt: row.joined_at,
      createdAt: row.created_at,
      urgency: rankUrgency(answers, now),
      openContactRequest: (() => {
        const request = contactRequests.get(row.id);
        return request ? { id: request.id, sentAt: request.sentAt } : null;
      })()
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
  documentKind: string;
  uploadedAt: string;
};

export type FirmRequiredDocumentStatus = {
  key: string;
  label: string;
  isCustom?: boolean;
  isUploaded: boolean;
  documents: FirmClientDocument[];
};

export type FirmClientDetail = {
  id: string;
  email: string;
  phone: string | null;
  fullName: string | null;
  pipelineStatus: FirmPipelineStatus;
  status: FirmClientStatus;
  joinedAt: string | null;
  completedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  engagementState: FirmClientEngagementState;
  answers: SharedAnswers;
  documents: FirmClientDocument[];
  requiredDocuments: FirmRequiredDocumentStatus[];
  additionalDocuments: FirmClientDocument[];
  openContactRequest: FirmContactRequest | null;
};

/** One client of this firm, or null. Always filters by both ids. */
export async function getFirmClient(firmId: string, firmClientId: string): Promise<FirmClientDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(firmClientId)) return null;
  const [{ data: row }, requiredDocs, contactRequest] = await Promise.all([
    admin()
      .from("firm_clients")
      .select("*")
      .eq("firm_id", firmId)
      .eq("id", firmClientId)
      .maybeSingle(),
    getFirmRequiredDocuments(firmId),
    openContactRequestFor(firmId, firmClientId)
  ]);
  if (!row) return null;
  const client = row as FirmClientRow;

  const answers = (client.shared_answers ?? {}) as SharedAnswers;
  let documents: FirmClientDocument[] = [];
  if (client.user_id) {
    const { data: docs } = await admin()
      .from("user_documents")
      .select("id, original_name, display_label, document_kind, uploaded_at")
      .eq("user_id", client.user_id)
      .eq("source_kind", "manual_upload")
      .order("uploaded_at", { ascending: false });
    documents = (docs ?? []).map((d: any) => ({
      id: d.id,
      name: d.original_name,
      kind: d.display_label || d.document_kind,
      documentKind: d.document_kind,
      uploadedAt: d.uploaded_at
    }));
  }

  const requiredDocuments: FirmRequiredDocumentStatus[] = [];
  const requiredKeys = new Set<string>();

  if (requiredDocs && requiredDocs.length > 0) {
    for (const req of requiredDocs) {
      requiredKeys.add(req.key);
      const matchingDocs = documents.filter((d) => d.documentKind === req.key);
      requiredDocuments.push({
        key: req.key,
        label: req.label,
        isCustom: req.isCustom,
        isUploaded: matchingDocs.length > 0,
        documents: matchingDocs
      });
    }
  }

  const additionalDocuments = requiredDocs && requiredDocs.length > 0
    ? documents.filter((d) => !requiredKeys.has(d.documentKind))
    : documents;

  const answersRecord = (client.shared_answers ?? {}) as Record<string, unknown>;
  const resolvedName = (typeof client.full_name === "string" && client.full_name.trim()) ||
    (typeof answers.fullName === "string" ? answers.fullName.trim() : null);
  const rawClientPhone = answersRecord.phone ?? answersRecord.phoneNumber;
  const resolvedPhone = client.phone ?? (typeof rawClientPhone === "string" ? rawClientPhone.trim() : null);

  return {
    id: client.id,
    email: client.normalized_email,
    phone: resolvedPhone || null,
    fullName: resolvedName || null,
    pipelineStatus: client.pipeline_status ?? "new_lead",
    status: firmClientStatus(client, answers),
    joinedAt: client.joined_at,
    completedAt: client.completed_at,
    reviewedAt: client.reviewed_at,
    createdAt: client.created_at,
    engagementState: cleanEngagementState(client.engagement_state),
    answers,
    documents,
    requiredDocuments,
    additionalDocuments,
    openContactRequest: contactRequest
  };
}

async function openContactRequestFor(firmId: string, firmClientId: string): Promise<FirmContactRequest | null> {
  const { data, error } = await admin()
    .from("firm_contact_requests")
    .select("id, practice_area, dates, questions, created_at")
    .eq("firm_id", firmId)
    .eq("firm_client_id", firmClientId)
    .is("handled_at", null)
    .maybeSingle();
  if (error) {
    console.error("[firm] could not load contact request", error.message);
    return null;
  }
  return data ? toContactRequest(data) : null;
}

/**
 * Marks one of this firm's open contact requests handled. Touches only the
 * request: the client's stage and urgency are the firm's and the dates' to
 * decide, not a side effect of answering a request.
 */
export async function markContactRequestHandled(firmId: string, requestId: string, handledBy: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return false;
  const { data, error } = await admin()
    .from("firm_contact_requests")
    .update({ handled_at: new Date().toISOString(), handled_by: handledBy })
    .eq("firm_id", firmId)
    .eq("id", requestId)
    .is("handled_at", null)
    .select("id");
  if (error) throw new Error(`Could not mark the request handled: ${error.message}`);
  return Boolean(data && data.length > 0);
}

/** Updates a client's engagement stage and note, scoped to this firm. */
export async function saveFirmClientEngagement(
  firmId: string,
  firmClientId: string,
  state: FirmClientEngagementState
): Promise<FirmClientEngagementState> {
  if (!/^[0-9a-f-]{36}$/i.test(firmClientId)) {
    throw new Error("Invalid client id.");
  }
  const cleaned = cleanEngagementState(state);
  const { error } = await admin()
    .from("firm_clients")
    .update({ engagement_state: cleaned })
    .eq("firm_id", firmId)
    .eq("id", firmClientId);
  if (error) {
    throw new Error(`Could not save client engagement: ${error.message}`);
  }
  return cleaned;
}

/** Updates a client's pipeline stage (e.g. from new_lead to consultation_completed or contract_signed). */
export async function updateFirmClientPipelineStatus(
  firmId: string,
  firmClientId: string,
  pipelineStatus: FirmPipelineStatus
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(firmClientId)) return false;
  const { data, error } = await admin()
    .from("firm_clients")
    .update({ pipeline_status: pipelineStatus })
    .eq("firm_id", firmId)
    .eq("id", firmClientId)
    .select("id");
  if (error) throw new Error(`Could not update pipeline status: ${error.message}`);
  return Boolean(data && data.length > 0);
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

export type FirmClientDossier = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  pipelineStatus: FirmPipelineStatus;
  joinedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  answers: SharedAnswers;
  documents: Array<{
    id: string;
    name: string;
    kind: string;
    documentKind: string;
    uploadedAt: string;
    downloadUrl: string | null;
  }>;
};

/** Full case file dossier with signed document URLs for Case Management Systems (Clio, MyCase, etc). */
export async function getFirmClientDossier(firmId: string, firmClientId: string): Promise<FirmClientDossier | null> {
  const client = await getFirmClient(firmId, firmClientId);
  if (!client) return null;

  const docsWithUrls = await Promise.all(
    client.documents.map(async (doc) => {
      const downloadUrl = await firmDocumentUrl(firmId, firmClientId, doc.id);
      return {
        ...doc,
        downloadUrl
      };
    })
  );

  return {
    id: client.id,
    fullName: client.fullName,
    email: client.email,
    phone: client.phone,
    pipelineStatus: client.pipelineStatus,
    joinedAt: client.joinedAt,
    completedAt: client.completedAt,
    createdAt: client.createdAt,
    answers: client.answers,
    documents: docsWithUrls
  };
}
