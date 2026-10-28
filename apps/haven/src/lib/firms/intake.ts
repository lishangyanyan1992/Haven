import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { isOwnerEmail, normalizeEmail } from "@/lib/access";
import { sharedAnswersFromProfile } from "@/lib/firms/answers";
import { cleanEngagementState } from "@/lib/firms/engagement";
import { lookupIntakeToken } from "@/lib/firms/links";
import type {
  FirmClientEngagementState,
  FirmClientRow,
  IntakeQuestionItem,
  RequiredDocumentItem
} from "@/lib/firms/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Joining a firm through its intake link. Two steps (design.md):
 *
 * 1. requestFirmIntake: the visitor enters an email. Haven records a pending
 *    firm client with a fresh one-time code and emails that address a link
 *    carrying the code. Nothing is granted yet.
 * 2. claimFirmInvite: on the set-password page that link opens, someone who
 *    is signed in as that address AND holds the code is attached to the firm
 *    and added to the invite list. An ordinary sign-in never does this, so
 *    typing someone's email on a link can't pull their account into a firm.
 *
 * Every outcome of step 1 gets the same reply, so the page never reveals
 * who uses Haven or which firm they belong to.
 */

function admin() {
  return createSupabaseAdminClient() as any;
}

export const INTAKE_LIMITS = {
  perEmailPerHour: 3,
  perVisitorPerHour: 10,
  perLinkPerDay: 100
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hashVisitor(ip: string) {
  const salt = process.env.FIRM_INTAKE_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "haven";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function hashClaimToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare of a presented code with the stored hash. */
export function claimTokenMatches(presented: string, storedHash: string | null | undefined) {
  if (!presented || !storedHash) return false;
  const a = Buffer.from(hashClaimToken(presented), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export type IntakeResult =
  | { status: "sent" }
  | { status: "invalid_email" }
  | { status: "invalid_name" }
  | { status: "invalid_phone" }
  | { status: "invalid_link" }
  | { status: "inactive_link" };

export function validateIntakePhone(rawPhone: string): boolean {
  if (!rawPhone || typeof rawPhone !== "string") return false;
  const digits = rawPhone.replace(/\D/g, "");
  return digits.length >= 7 && rawPhone.trim().length <= 30;
}

export function validateIntakeName(rawName: string): boolean {
  if (!rawName || typeof rawName !== "string") return false;
  const trimmed = rawName.trim();
  return trimmed.length >= 1 && trimmed.length <= 200;
}

/** What to do with an email entered on a link. Pure, so it can be checked. */
export type IntakeDecision =
  | { action: "ignore"; reason: "owner" | "lawyer" | "other_firm" | "already_joined" }
  | { action: "invite_new" }
  | { action: "resend_same_firm" };

export function decideIntake(input: {
  email: string;
  linkFirmId: string;
  isLawyer: boolean;
  existingClient: Pick<FirmClientRow, "firm_id" | "joined_at"> | null;
}): IntakeDecision {
  if (isOwnerEmail(input.email)) return { action: "ignore", reason: "owner" };
  if (input.isLawyer) return { action: "ignore", reason: "lawyer" };
  if (input.existingClient && input.existingClient.firm_id !== input.linkFirmId) return { action: "ignore", reason: "other_firm" };
  // Already in this firm: they sign in as usual. Nothing to send or claim.
  if (input.existingClient?.joined_at) return { action: "ignore", reason: "already_joined" };
  if (input.existingClient) return { action: "resend_same_firm" };
  return { action: "invite_new" };
}

/**
 * Email the address a link carrying the one-time code: a new-account invite,
 * or, if the address already has an account, a password-reset link (which
 * also signs them in). Both land on /reset-password, which claims the code.
 */
async function sendSignUpEmail(email: string, claimToken: string): Promise<boolean> {
  const next = `/reset-password?claim=${encodeURIComponent(claimToken)}`;
  const redirectTo = `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await admin().auth.admin.inviteUserByEmail(email, { redirectTo });
  if (!error) return true;
  if (!/already|registered|exists/i.test(error.message)) {
    console.error("[firm-intake] invite email failed", error.message);
    return false;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: resetError } = await anon.auth.resetPasswordForEmail(email, { redirectTo });
  if (resetError) {
    console.error("[firm-intake] sign-in email failed", resetError.message);
    return false;
  }
  return true;
}

export async function requestFirmIntake(
  token: string,
  rawEmail: string,
  rawFullNameOrIp: string,
  rawPhone?: string,
  visitorIp?: string
): Promise<IntakeResult> {
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_PATTERN.test(email) || email.length > 320) return { status: "invalid_email" };

  const isLegacyThreeArg = rawPhone === undefined && visitorIp === undefined;
  const fullName = isLegacyThreeArg ? "" : String(rawFullNameOrIp ?? "").trim();
  const phone = isLegacyThreeArg ? "" : String(rawPhone ?? "").trim();
  const effectiveIp = isLegacyThreeArg ? rawFullNameOrIp : visitorIp || "unknown";

  if (!isLegacyThreeArg) {
    if (!validateIntakeName(fullName)) return { status: "invalid_name" };
    if (!validateIntakePhone(phone)) return { status: "invalid_phone" };
  }

  const link = await lookupIntakeToken(token);
  if (link.state === "invalid") return { status: "invalid_link" };
  if (link.state === "inactive") return { status: "inactive_link" };

  const [lawyer, pilotRequest, existing] = await Promise.all([
    admin().from("firm_members").select("user_id").eq("email", email).maybeSingle(),
    admin().from("firm_pilot_requests").select("id").eq("normalized_email", email).maybeSingle(),
    admin()
      .from("firm_clients")
      .select("firm_id, joined_at")
      .eq("normalized_email", email)
      .eq("firm_id", link.firmId)
      .maybeSingle()
  ]);

  if (lawyer.error || pilotRequest.error || existing.error) return { status: "sent" };

  const decision = decideIntake({
    email,
    linkFirmId: link.firmId,
    isLawyer: Boolean(lawyer.data || pilotRequest.data),
    existingClient: existing.data ?? null
  });
  if (decision.action === "ignore") return { status: "sent" };

  // Check the limits and record this send in one locked step, so parallel
  // requests can't all slip under a limit. If it can't be recorded, don't send.
  const { data: reserved, error: reserveError } = await admin().rpc("firm_intake_reserve_send", {
    p_link_id: link.linkId,
    p_email: email,
    p_ip_hash: hashVisitor(effectiveIp || "unknown"),
    p_email_per_hour: INTAKE_LIMITS.perEmailPerHour,
    p_visitor_per_hour: INTAKE_LIMITS.perVisitorPerHour,
    p_link_per_day: INTAKE_LIMITS.perLinkPerDay
  });
  if (reserveError) {
    console.error("[firm-intake] could not reserve send", reserveError.message);
    return { status: "sent" };
  }
  if (reserved !== true) return { status: "sent" };

  // A fresh code on every send, so only the newest email works.
  const claimToken = randomBytes(32).toString("base64url");
  const claimTokenHash = hashClaimToken(claimToken);

  // Save the code before emailing it, so a delivered link always works. The
  // previous code moves aside and stays valid, so if this send fails, the
  // link in the earlier email still works.
  if (decision.action === "invite_new") {
    const insertPayload: Record<string, any> = {
      firm_id: link.firmId,
      normalized_email: email,
      link_id: link.linkId,
      claim_token_hash: claimTokenHash
    };
    if (fullName) insertPayload.full_name = fullName;
    if (phone) insertPayload.phone = phone;
    insertPayload.pipeline_status = "new_lead";

    const { error } = await admin()
      .from("firm_clients")
      .insert(insertPayload);
    if (error) {
      // A unique clash means another request just claimed this email.
      if (!/duplicate|unique/i.test(error.message)) console.error("[firm-intake] could not record client", error.message);
      return { status: "sent" };
    }
  } else {
    const { data: current } = await admin()
      .from("firm_clients")
      .select("claim_token_hash")
      .eq("normalized_email", email)
      .eq("firm_id", link.firmId)
      .is("joined_at", null)
      .maybeSingle();
    const updatePayload: Record<string, any> = {
      email_sent_at: new Date().toISOString(),
      claim_token_hash: claimTokenHash,
      previous_claim_token_hash: current?.claim_token_hash ?? null
    };
    if (fullName) updatePayload.full_name = fullName;
    if (phone) updatePayload.phone = phone;

    const { error } = await admin()
      .from("firm_clients")
      .update(updatePayload)
      .eq("normalized_email", email)
      .eq("firm_id", link.firmId)
      .is("joined_at", null);
    if (error) {
      console.error("[firm-intake] could not save code", error.message);
      return { status: "sent" };
    }
  }

  await sendSignUpEmail(email, claimToken);
  return { status: "sent" };
}

/**
 * Attach a signed-in account to the firm whose intake email it opened.
 * Requires a confirmed email that matches the pending row AND the one-time
 * code from that email. The code is used up on success.
 */
export async function claimFirmInvite(
  user: { id: string; email?: string | null; email_confirmed_at?: string | null },
  claimToken: string
): Promise<"joined" | "ignored"> {
  const email = normalizeEmail(user.email);
  if (!email || !user.email_confirmed_at || !claimToken) return "ignored";

  // A firm lawyer account cannot join as a client.
  const { data: asLawyer } = await admin()
    .from("firm_members")
    .select("user_id")
    .or(`user_id.eq.${user.id},email.eq.${email}`)
    .maybeSingle();
  if (asLawyer) return "ignored";

  const { data: rows, error: rowsError } = await admin()
    .from("firm_clients")
    .select("id, firm_id, user_id, joined_at, claim_token_hash, previous_claim_token_hash")
    .or(`normalized_email.eq.${email},user_id.eq.${user.id}`);
  if (rowsError || !rows || rows.length === 0) return "ignored";

  const matchingRow = rows.find(
    (r: any) =>
      claimTokenMatches(claimToken, r.claim_token_hash) ||
      claimTokenMatches(claimToken, r.previous_claim_token_hash)
  );

  const row = matchingRow ?? rows.find((r: any) => r.joined_at && r.user_id === user.id);
  if (!row) return "ignored";
  if (row.user_id && row.user_id !== user.id) return "ignored";

  // Already joined by this same person (say, the page ran twice): make sure
  // their access is in place, in case granting it failed last time.
  if (row.joined_at) return row.user_id === user.id && (await grantAccess(email, row.firm_id)) ? "joined" : "ignored";
  if (!claimTokenMatches(claimToken, row.claim_token_hash) && !claimTokenMatches(claimToken, row.previous_claim_token_hash)) {
    return "ignored";
  }

  // Access first: if it can't be granted, nothing is changed and the code
  // still works, so trying the link again can succeed.
  if (!(await grantAccess(email, row.firm_id))) return "ignored";

  // Someone who finished setup before joining shows as Finished (and New)
  // straight away, with the setup answers they'd already given.
  const [{ data: alias }, { data: profile }] = await Promise.all([
    admin().from("email_aliases").select("id").eq("user_id", user.id).maybeSingle(),
    admin().from("user_profiles").select("*").eq("id", user.id).maybeSingle()
  ]);
  const now = new Date().toISOString();

  const { error } = await admin()
    .from("firm_clients")
    .update({
      user_id: user.id,
      joined_at: now,
      claim_token_hash: null,
      previous_claim_token_hash: null,
      completed_at: alias ? now : null,
      // Only a finished setup is copied: a half-done one still holds the
      // placeholder defaults new accounts start with. They'll fill the rest
      // in through setup, which updates the firm's copy as they go.
      shared_answers: alias ? sharedAnswersFromProfile(profile ?? null) : {}
    })
    .eq("id", row.id)
    .is("joined_at", null);
  if (error) {
    console.error("[firm-intake] could not attach client", error.message);
    return "ignored";
  }
  return "joined";
}

/** Put the email on the invite list. True if it's there afterwards. */
async function grantAccess(email: string, firmId: string) {
  const { error } = await admin()
    .from("access_invites")
    .upsert({ normalized_email: email, invited_by: `firm:${firmId}` }, { onConflict: "normalized_email", ignoreDuplicates: true });
  if (error) {
    console.error("[firm-intake] could not add invite", error.message);
    return false;
  }
  return true;
}

/** Called when a client finishes setup. Starts their New badge. */
export async function markFirmClientCompleted(userId: string) {
  await admin()
    .from("firm_clients")
    .update({ completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("completed_at", null);
}

/**
 * Grant access to a firm for an already signed-in user visiting an intake link.
 */
export async function grantFirmAccessForUser(
  user: { id: string; email?: string | null },
  token: string
): Promise<{
  status: "granted" | "already_connected" | "invalid_link" | "inactive_link" | "is_lawyer" | "error";
  firmName?: string;
}> {
  const email = normalizeEmail(user.email);
  if (!user.id || !email) return { status: "error" };

  // A firm lawyer account cannot join as a client.
  const { data: asLawyer } = await admin()
    .from("firm_members")
    .select("user_id")
    .or(`user_id.eq.${user.id},email.eq.${email}`)
    .maybeSingle();
  if (asLawyer) return { status: "is_lawyer" };

  const link = await lookupIntakeToken(token);
  if (link.state === "invalid") return { status: "invalid_link" };
  if (link.state === "inactive") return { status: "inactive_link" };

  // Check if this user is already connected to this firm
  const { data: existing } = await admin()
    .from("firm_clients")
    .select("id, joined_at, user_id")
    .eq("firm_id", link.firmId)
    .or(`user_id.eq.${user.id},normalized_email.eq.${email}`)
    .maybeSingle();

  if (existing?.joined_at) {
    await grantAccess(email, link.firmId);
    return { status: "already_connected", firmName: link.firmName };
  }

  if (!(await grantAccess(email, link.firmId))) return { status: "error" };

  const [{ data: alias }, { data: profile }] = await Promise.all([
    admin().from("email_aliases").select("id").eq("user_id", user.id).maybeSingle(),
    admin().from("user_profiles").select("*").eq("id", user.id).maybeSingle()
  ]);
  const now = new Date().toISOString();

  if (existing) {
    const { error: updateError } = await admin()
      .from("firm_clients")
      .update({
        user_id: user.id,
        joined_at: now,
        claim_token_hash: null,
        previous_claim_token_hash: null,
        completed_at: alias ? now : null,
        shared_answers: alias ? sharedAnswersFromProfile(profile ?? null) : {}
      })
      .eq("id", existing.id);
    if (updateError) {
      console.error("[firm-intake] could not update firm client access", updateError.message);
      return { status: "error" };
    }
  } else {
    const fullName = profile?.full_name ? String(profile.full_name).trim() : null;
    const phone = profile?.phone ? String(profile.phone).trim() : null;
    const insertPayload: Record<string, any> = {
      firm_id: link.firmId,
      normalized_email: email,
      user_id: user.id,
      link_id: link.linkId,
      joined_at: now,
      pipeline_status: "new_lead",
      completed_at: alias ? now : null,
      shared_answers: alias ? sharedAnswersFromProfile(profile ?? null) : {}
    };
    if (fullName) insertPayload.full_name = fullName;
    if (phone) insertPayload.phone = phone;

    const { error: insertError } = await admin()
      .from("firm_clients")
      .insert(insertPayload);
    if (insertError) {
      console.error("[firm-intake] could not grant firm client access", insertError.message);
      return { status: "error" };
    }
  }

  return { status: "granted", firmName: link.firmName };
}

export type ClientFirmInfo = {
  firmId: string;
  firmName: string;
  requiredDocuments: RequiredDocumentItem[];
  intakeQuestions: IntakeQuestionItem[];
};

/** All firms a signed-in client has joined. */
export async function getClientFirms(userId: string | null | undefined): Promise<ClientFirmInfo[]> {
  if (!userId) return [];
  const { data, error } = await admin()
    .from("firm_clients")
    .select("firm_id, joined_at, firms(name, required_documents, intake_questions)")
    .eq("user_id", userId)
    .not("joined_at", "is", null);
  if (error || !data) return [];
  return data.map((row: any) => ({
    firmId: row.firm_id,
    firmName: row.firms?.name ?? "your law firm",
    requiredDocuments: Array.isArray(row.firms?.required_documents) ? row.firms.required_documents : [],
    intakeQuestions: Array.isArray(row.firms?.intake_questions) ? row.firms.intake_questions : []
  }));
}

/** The primary firm a signed-in client joined, for backwards compatibility. */
export async function getClientFirm(userId: string | null | undefined): Promise<{ firmId: string; firmName: string } | null> {
  const firms = await getClientFirms(userId);
  return firms[0] ? { firmId: firms[0].firmId, firmName: firms[0].firmName } : null;
}

export type ClientFirmEngagementRecord = {
  firmId: string;
  firmName: string;
  joinedAt: string | null;
  completedAt: string | null;
  reviewedAt: string | null;
  bookingUrl: string | null;
  bookingEmail: string | null;
  engagementState: FirmClientEngagementState;
  requiredDocuments?: string[];
};

/** All firm engagement records for a signed-in client, ordered by joined date. */
export async function getClientFirmEngagementRecords(
  userId: string | null | undefined
): Promise<ClientFirmEngagementRecord[]> {
  if (!userId) return [];
  const { data, error } = await admin()
    .from("firm_clients")
    .select("*, firms(name, consultation_booking_url, consultation_email, required_documents)")
    .eq("user_id", userId)
    .not("joined_at", "is", null)
    .order("joined_at", { ascending: false });
  if (error || !data) return [];

  return data.map((row: any) => {
    const clientState = cleanEngagementState(row.engagement_state);
    const bookingUrl = clientState.bookingUrl ?? row.firms?.consultation_booking_url ?? null;
    const bookingEmail = clientState.bookingEmail ?? row.firms?.consultation_email ?? null;

    return {
      firmId: row.firm_id,
      firmName: row.firms?.name ?? "your law firm",
      joinedAt: row.joined_at ?? null,
      completedAt: row.completed_at ?? null,
      reviewedAt: row.reviewed_at ?? null,
      bookingUrl,
      bookingEmail,
      engagementState: clientState,
      requiredDocuments: Array.isArray(row.firms?.required_documents) ? row.firms.required_documents : []
    };
  });
}

/** Full firm engagement record for a signed-in client (primary / latest firm). */
export async function getClientFirmEngagementRecord(
  userId: string | null | undefined
): Promise<ClientFirmEngagementRecord | null> {
  const records = await getClientFirmEngagementRecords(userId);
  return records[0] ?? null;
}

export async function isJoinedFirmClientEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const { data } = await admin()
    .from("firm_clients")
    .select("joined_at")
    .eq("normalized_email", normalized)
    .not("joined_at", "is", null)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.joined_at);
}
