import { HAVEN_VAULT_BUCKET } from "@/lib/document-vault";
import { firmClientsWithUnreadMessages } from "@/lib/firms/firm-messages";
import { helpNeededLabels } from "@/lib/firms/help-needed";
import type { SharedAnswers } from "@/lib/firms/answers";
import { cleanEngagementState } from "@/lib/firms/engagement";
import { getFirmRequiredDocuments } from "@/lib/firms/required-documents";
import { parseFirmGreenCardSponsors } from "@/lib/firms/green-cards";
import { expandRequiredDocuments, type ChecklistStatus } from "@/lib/sponsor-documents";
import {
  describeFacts,
  disagreementsFrom,
  toStoredFact,
  type Disagreement,
  type FactLine,
  type StoredFact
} from "@/lib/document-facts/describe";
import { toFieldSource } from "@/lib/field-sources/db";
import type { FieldSource } from "@/lib/field-sources/plan";
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
  /** Fields where the client's value and a document disagree and nobody has settled it. */
  toCheckCount?: number;
  joinedAt: string | null;
  createdAt: string;
  urgency: Urgency;
  /** Shown beside the urgency, never part of it: asking does not move anyone up the list. */
  openContactRequest: { id: string; sentAt: string } | null;
  /** "What help do you need from your lawyer?", as plain labels. */
  helpNeeded: string[];
  /** The client wrote since anyone at the firm last opened their messages. Never part of the urgency. */
  hasUnreadMessages: boolean;
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
  const [rows, requiredDocs, contactRequests, unreadClients] = await Promise.all([
    firmClientRows(firmId),
    getFirmRequiredDocuments(firmId),
    openContactRequests(firmId),
    firmClientsWithUnreadMessages(firmId)
  ]);
  const userIds = rows.map((r) => r.user_id).filter((id): id is string => Boolean(id));

  const docCounts = new Map<string, number>();
  const userDocs = new Map<string, Array<{ id: string; documentKind: string; petitionId: string | null }>>();

  if (userIds.length > 0) {
    const { data: docRows } = await admin()
      .from("user_documents")
      .select("id, user_id, document_kind, petition_id")
      .in("user_id", userIds);
    for (const d of docRows ?? []) {
      docCounts.set(d.user_id, (docCounts.get(d.user_id) ?? 0) + 1);
      if (!userDocs.has(d.user_id)) userDocs.set(d.user_id, []);
      userDocs.get(d.user_id)!.push({ id: d.id, documentKind: d.document_kind, petitionId: d.petition_id ?? null });
    }
  }

  const openDisagreements = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: openRows } = await admin()
      .from("field_sources")
      .select("user_id")
      .in("user_id", userIds)
      .eq("resolution", "open");
    for (const r of openRows ?? []) openDisagreements.set(r.user_id, (openDisagreements.get(r.user_id) ?? 0) + 1);
  }

  const hasRequirements = (requiredDocs?.length ?? 0) > 0;
  const firmSuffix = `_${firmId.slice(0, 8)}`;
  const now = new Date();
  const summaries: FirmClientSummary[] = rows.map((row) => {
    const answersRecord = (row.shared_answers ?? {}) as Record<string, unknown>;
    const answers = (row.shared_answers ?? {}) as SharedAnswers;
    const status = firmClientStatus(row, answers);
    const resolvedName = (typeof row.full_name === "string" && row.full_name.trim()) ||
      (typeof answers.fullName === "string" ? answers.fullName.trim() : "");
    const rawPhone = answersRecord.phone ?? answersRecord.phoneNumber;
    const resolvedPhone = row.phone ?? (typeof rawPhone === "string" ? rawPhone.trim() : null);

    // Sponsor documents count once per sponsor; "not needed yet" items don't count.
    let requiredDocumentCount: number | undefined;
    let totalRequired = 0;
    if (hasRequirements) {
      const checklist = expandRequiredDocuments({
        items: requiredDocs ?? [],
        petitions: parseFirmGreenCardSponsors(answers.greenCardSponsors),
        employerName: typeof answers.employerName === "string" ? answers.employerName : null,
        documents: row.user_id ? userDocs.get(row.user_id) ?? [] : [],
        kindMatches: (kind, key) => kind === key || kind === `${key}${firmSuffix}`
      });
      requiredDocumentCount = checklist.uploadedCount;
      totalRequired = checklist.requestedCount;
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
      totalRequiredCount: hasRequirements ? totalRequired : undefined,
      toCheckCount: row.user_id ? openDisagreements.get(row.user_id) ?? 0 : 0,
      joinedAt: row.joined_at,
      createdAt: row.created_at,
      urgency: rankUrgency(answers, now),
      openContactRequest: (() => {
        const request = contactRequests.get(row.id);
        return request ? { id: request.id, sentAt: request.sentAt } : null;
      })(),
      helpNeeded: helpNeededLabels(answers.helpNeeded),
      hasUnreadMessages: unreadClients.has(row.id)
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
  petitionId: string | null;
  /** What Haven took from it. Empty when nothing was read. */
  details: FactLine[];
  /** Set when a green card was created from this document. */
  createdSponsor: string | null;
};

export type FirmRequiredDocumentStatus = {
  /** Unique per checklist entry (requirement key, plus the sponsor's green card id). */
  key: string;
  label: string;
  isCustom?: boolean;
  isUploaded: boolean;
  status: ChecklistStatus;
  /** Why it isn't asked yet, when status is "not_needed_yet". */
  reason?: string;
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
  /** Fields where the client's value differs from a document's, open ones first. */
  disagreements: Disagreement[];
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
      .select("id, original_name, display_label, document_kind, uploaded_at, petition_id")
      .eq("user_id", client.user_id)
      .eq("source_kind", "manual_upload")
      .order("uploaded_at", { ascending: false });
    documents = (docs ?? []).map((d: any) => ({
      id: d.id,
      name: d.original_name,
      kind: d.display_label || d.document_kind,
      documentKind: d.document_kind,
      uploadedAt: d.uploaded_at,
      petitionId: d.petition_id ?? null,
      details: [],
      createdSponsor: null
    }));
  }

  // What Haven read from each document, and where the client disagrees with one.
  let disagreements: Disagreement[] = [];
  if (client.user_id) {
    const sponsors = new Map(parseFirmGreenCardSponsors(answers.greenCardSponsors).map((p) => [p.id, p.sponsorName]));
    const [{ data: factRows }, { data: sourceRows }] = await Promise.all([
      admin().from("document_facts").select("*").eq("user_id", client.user_id),
      admin().from("field_sources").select("*").eq("user_id", client.user_id)
    ]);
    const facts: StoredFact[] = (factRows ?? []).map(toStoredFact);
    const sources: FieldSource[] = (sourceRows ?? []).map(toFieldSource);
    const sourceMap = new Map<string, FieldSource>(sources.map((s) => [s.fieldKey, s]));
    documents = documents.map((d) => {
      const described = describeFacts(facts.filter((f) => f.documentId === d.id), sponsors, sourceMap);
      return { ...d, details: described.lines, createdSponsor: described.createdSponsor };
    });
    disagreements = disagreementsFrom(sources, new Map(facts.map((f) => [f.id, f.documentId])), sponsors);
  }

  const requiredDocuments: FirmRequiredDocumentStatus[] = [];
  const requiredKeys = new Set<string>();

  if (requiredDocs && requiredDocs.length > 0) {
    const firmSuffix = `_${firmId.slice(0, 8)}`;
    const kindMatches = (kind: string, key: string) => kind === key || kind === `${key}${firmSuffix}`;
    const checklist = expandRequiredDocuments({
      items: requiredDocs,
      petitions: parseFirmGreenCardSponsors(answers.greenCardSponsors),
      employerName: typeof answers.employerName === "string" ? answers.employerName : null,
      documents,
      kindMatches
    });
    for (const req of requiredDocs) requiredKeys.add(req.key);
    for (const entry of checklist.entries) {
      requiredDocuments.push({
        key: entry.id,
        label: entry.label,
        isCustom: entry.isCustom,
        isUploaded: entry.status === "uploaded",
        status: entry.status,
        reason: entry.reason,
        documents: entry.documents
      });
    }
  }

  const additionalDocuments = requiredDocs && requiredDocs.length > 0
    ? documents.filter((d) => ![...requiredKeys].some((key) => d.documentKind === key || d.documentKind === `${key}_${firmId.slice(0, 8)}`))
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
    disagreements,
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

export type FirmConsultationBooking = {
  bookingUrl: string | null;
  bookingEmail: string | null;
};

/** Load the sponsoring firm's consultation booking channels. */
export async function getFirmConsultationBooking(firmId: string): Promise<FirmConsultationBooking> {
  const { data, error } = await admin()
    .from("firms")
    .select("consultation_booking_url, consultation_email")
    .eq("id", firmId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load firm consultation booking: ${error.message}`);
  }

  return {
    bookingUrl: data?.consultation_booking_url ?? null,
    bookingEmail: data?.consultation_email ?? null
  };
}

/** Save or clear the sponsoring firm's consultation booking channels. */
export async function saveFirmConsultationBooking(
  firmId: string,
  input: { bookingUrl?: string | null; bookingEmail?: string | null }
): Promise<FirmConsultationBooking> {
  const { error } = await admin()
    .from("firms")
    .update({
      consultation_booking_url: input.bookingUrl ?? null,
      consultation_email: input.bookingEmail ?? null
    })
    .eq("id", firmId);

  if (error) {
    throw new Error(`Could not save firm consultation booking: ${error.message}`);
  }

  return {
    bookingUrl: input.bookingUrl ?? null,
    bookingEmail: input.bookingEmail ?? null
  };
}
