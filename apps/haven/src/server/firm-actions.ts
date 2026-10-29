"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireFirmMember } from "@/lib/firms/access";
import {
  firmDocumentUrl,
  getFirmClientDossier,
  markContactRequestHandled,
  saveFirmClientEngagement,
  saveFirmConsultationBooking,
  updateFirmClientPipelineStatus
} from "@/lib/firms/clients";
import { resetDemoFirm } from "@/lib/firms/demo";
import { markFirmConversationRead, sendFirmMessage, type FirmSendResult } from "@/lib/firms/firm-messages";
import { validateConsultationBooking, validateEngagementUpdate } from "@/lib/firms/engagement";
import { claimFirmInvite, grantFirmAccessForUser, requestFirmIntake, type IntakeResult } from "@/lib/firms/intake";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { intakeUrl, replaceFirmLink, setFirmLinkActive } from "@/lib/firms/links";
import { saveFirmIntakeQuestions, validateIntakeQuestionList } from "@/lib/firms/intake-questions";
import { saveFirmRequiredDocuments } from "@/lib/firms/required-documents";
import { validateRequiredDocumentList } from "@/lib/document-vault";
import {
  FIRM_PIPELINE_STATUS_LABEL,
  type FirmClientEngagementState,
  type FirmPipelineStatus,
  type IntakeQuestionItem,
  type RequiredDocumentItem
} from "@/lib/firms/types";

/**
 * Firm dashboard actions. The firm always comes from requireFirmMember(),
 * never from the caller. evals/firms/isolation.check.ts enforces this.
 */

export async function saveFirmRequiredDocumentsAction(
  items: unknown
): Promise<{ ok: true; items: RequiredDocumentItem[] } | { ok: false; error: string }> {
  const membership = await requireFirmMember();
  const validation = validateRequiredDocumentList(items);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const saved = await saveFirmRequiredDocuments(membership.firmId, items);
  revalidatePath("/firm");
  revalidatePath("/documents");
  revalidatePath("/onboarding");
  return { ok: true, items: saved };
}

export async function saveFirmIntakeQuestionsAction(
  items: unknown
): Promise<{ ok: true; items: IntakeQuestionItem[] } | { ok: false; error: string }> {
  const membership = await requireFirmMember();
  const validation = validateIntakeQuestionList(items);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const saved = await saveFirmIntakeQuestions(membership.firmId, items);
  revalidatePath("/firm");
  revalidatePath("/onboarding");
  return { ok: true, items: saved };
}

export async function saveFirmConsultationBookingAction(
  payload: unknown
): Promise<{ ok: true; booking: { bookingUrl: string | null; bookingEmail: string | null } } | { ok: false; error: string }> {
  const membership = await requireFirmMember();
  const validation = validateConsultationBooking(payload);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const booking = await saveFirmConsultationBooking(membership.firmId, {
    bookingUrl: validation.bookingUrl,
    bookingEmail: validation.bookingEmail
  });
  revalidatePath("/firm");
  revalidatePath("/dashboard");
  return { ok: true, booking };
}

export async function setFirmLinkActiveAction(isActive: boolean) {
  const membership = await requireFirmMember();
  await setFirmLinkActive(membership.firmId, Boolean(isActive));
  revalidatePath("/firm");
}

export async function replaceFirmLinkAction(): Promise<{ url: string }> {
  const membership = await requireFirmMember();
  const link = await replaceFirmLink(membership.firmId);
  revalidatePath("/firm");
  return { url: intakeUrl(link.token) };
}

export async function openFirmDocumentAction(firmClientId: string, documentId: string): Promise<{ url: string | null }> {
  const membership = await requireFirmMember();
  const url = await firmDocumentUrl(membership.firmId, String(firmClientId), String(documentId));
  return { url };
}

export async function saveFirmClientEngagementAction(
  firmClientId: string,
  payload: unknown
): Promise<{ ok: true; state: FirmClientEngagementState } | { ok: false; error: string }> {
  const membership = await requireFirmMember();
  const validation = validateEngagementUpdate(payload);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const saved = await saveFirmClientEngagement(membership.firmId, String(firmClientId), validation.state);
  revalidatePath(`/firm/clients/${firmClientId}`);
  revalidatePath("/firm");
  revalidatePath("/dashboard");
  return { ok: true, state: saved };
}

/**
 * Resets demo firm clients and dates. Strictly rejected for non-demo firms.
 */
export async function resetDemoFirmAction(): Promise<{ ok: boolean; count: number }> {
  const membership = await requireFirmMember();
  if (!membership.isDemo) {
    throw new Error("Demo reset is only available for demo accounts.");
  }
  const result = await resetDemoFirm(membership.firmId, new Date());
  revalidatePath("/firm");
  return { ok: true, count: result.count };
}

/**
 * The set-password page opened from a firm's intake email. Joins the
 * signed-in account to that firm if it holds the email's one-time code.
 */
export async function claimFirmInviteAction(claimToken: string): Promise<{ joined: boolean }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { joined: false };
  const result = await claimFirmInvite(user, String(claimToken ?? ""));
  return { joined: result === "joined" };
}

/** Signed-in client grants access to a firm directly on /i/[token]. */
export async function grantFirmAccessAction(
  token: string
): Promise<{
  ok: boolean;
  status: "granted" | "already_connected" | "not_authenticated" | "is_lawyer" | "invalid_link" | "inactive_link" | "error";
}> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, status: "not_authenticated" };

  const result = await grantFirmAccessForUser(user, String(token ?? ""));
  if (result.status === "granted" || result.status === "already_connected") {
    revalidatePath("/dashboard");
    revalidatePath("/documents");
    revalidatePath("/onboarding");
    return { ok: true, status: result.status };
  }
  return { ok: false, status: result.status };
}

/** Public: the intake form on a firm's intake link. */
export async function requestFirmIntakeAction(
  token: string,
  email: string,
  fullName?: string,
  phone?: string
): Promise<IntakeResult> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  return requestFirmIntake(
    String(token ?? ""),
    String(email ?? ""),
    String(fullName ?? ""),
    String(phone ?? ""),
    ip
  );
}

export async function updateFirmClientPipelineStatusAction(
  firmClientId: string,
  pipelineStatus: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const membership = await requireFirmMember();
  if (
    typeof pipelineStatus !== "string" ||
    !Object.hasOwn(FIRM_PIPELINE_STATUS_LABEL, pipelineStatus)
  ) {
    return { ok: false, error: "Invalid pipeline status" };
  }
  const updated = await updateFirmClientPipelineStatus(
    membership.firmId,
    firmClientId,
    pipelineStatus as FirmPipelineStatus
  );
  if (!updated) return { ok: false, error: "Client not found" };
  revalidatePath("/firm");
  revalidatePath("/firm/clients");
  revalidatePath(`/firm/clients/${firmClientId}`);
  return { ok: true };
}

/** Marks one of this firm's open contact requests handled, so the client can ask again. */
export async function markContactRequestHandledAction(
  firmClientId: string,
  requestId: string
): Promise<{ ok: boolean }> {
  const membership = await requireFirmMember();
  const handled = await markContactRequestHandled(membership.firmId, requestId, membership.userId);
  if (handled) {
    revalidatePath("/firm");
    revalidatePath("/firm/clients");
    revalidatePath(`/firm/clients/${firmClientId}`);
  }
  return { ok: handled };
}

export async function exportFirmClientDossierAction(firmClientId: string): Promise<{
  ok: boolean;
  dossier?: any;
  error?: string;
}> {
  const membership = await requireFirmMember();
  const dossier = await getFirmClientDossier(membership.firmId, firmClientId);
  if (!dossier) return { ok: false, error: "Client not found" };
  return { ok: true, dossier };
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A lawyer's message to a client, or a reply to one of the client's AI
 * answers. The firm comes from requireFirmMember(); the client and the answer
 * are checked against that firm before anything is saved.
 */
export async function sendFirmMessageAction(input: {
  firmClientId: string;
  body: string;
  aiAnswerId?: string | null;
}): Promise<FirmSendResult> {
  const membership = await requireFirmMember();
  if (!uuidPattern.test(String(input.firmClientId ?? ""))) return { status: "not_found" };
  if (input.aiAnswerId && !uuidPattern.test(String(input.aiAnswerId))) return { status: "not_found" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const metaName = typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";

  const result = await sendFirmMessage(membership.firmId, {
    firmClientId: input.firmClientId,
    lawyerUserId: membership.userId,
    lawyerName: metaName || membership.email,
    firmName: membership.firmName,
    body: input.body,
    aiAnswerId: input.aiAnswerId ?? null
  });
  if (result.status === "sent") {
    revalidatePath(`/firm/clients/${input.firmClientId}`);
    revalidatePath("/firm");
  }
  return result;
}

/** Opening a client's messages clears the unread marker for the whole firm. */
export async function markFirmConversationReadAction(firmClientId: string): Promise<{ ok: boolean }> {
  const membership = await requireFirmMember();
  if (!uuidPattern.test(String(firmClientId ?? ""))) return { ok: false };
  const ok = await markFirmConversationRead(membership.firmId, firmClientId);
  if (ok) revalidatePath("/firm");
  return { ok };
}
