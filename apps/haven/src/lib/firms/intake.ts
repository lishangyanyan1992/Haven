import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { isOwnerEmail, normalizeEmail } from "@/lib/access";
import { sharedAnswersFromProfile } from "@/lib/firms/answers";
import { lookupIntakeToken } from "@/lib/firms/links";
import type { FirmClientRow } from "@/lib/firms/types";
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

export type IntakeResult = { status: "sent" } | { status: "invalid_email" } | { status: "invalid_link" } | { status: "inactive_link" };

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
async function sendSignUpEmail(email: string, claimToken: string) {
  const next = `/reset-password?claim=${encodeURIComponent(claimToken)}`;
  const redirectTo = `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
  const { error } = await admin().auth.admin.inviteUserByEmail(email, { redirectTo });
  if (!error) return;
  if (!/already|registered|exists/i.test(error.message)) {
    console.error("[firm-intake] invite email failed", error.message);
    return;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return;
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: resetError } = await anon.auth.resetPasswordForEmail(email, { redirectTo });
  if (resetError) console.error("[firm-intake] sign-in email failed", resetError.message);
}

export async function requestFirmIntake(token: string, rawEmail: string, visitorIp: string): Promise<IntakeResult> {
  const email = normalizeEmail(rawEmail);
  if (!EMAIL_PATTERN.test(email) || email.length > 320) return { status: "invalid_email" };

  const link = await lookupIntakeToken(token);
  if (link.state === "invalid") return { status: "invalid_link" };
  if (link.state === "inactive") return { status: "inactive_link" };

  const [lawyer, existing] = await Promise.all([
    admin().from("firm_members").select("user_id").eq("email", email).maybeSingle(),
    admin().from("firm_clients").select("firm_id, joined_at").eq("normalized_email", email).maybeSingle()
  ]);

  const decision = decideIntake({
    email,
    linkFirmId: link.firmId,
    isLawyer: Boolean(lawyer.data),
    existingClient: existing.data ?? null
  });
  if (decision.action === "ignore") return { status: "sent" };

  // Check the limits and record this send in one locked step, so parallel
  // requests can't all slip under a limit. If it can't be recorded, don't send.
  const { data: reserved, error: reserveError } = await admin().rpc("firm_intake_reserve_send", {
    p_link_id: link.linkId,
    p_email: email,
    p_ip_hash: hashVisitor(visitorIp || "unknown"),
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

  if (decision.action === "invite_new") {
    const { error } = await admin()
      .from("firm_clients")
      .insert({ firm_id: link.firmId, normalized_email: email, link_id: link.linkId, claim_token_hash: claimTokenHash });
    if (error) {
      // A unique clash means another request just claimed this email.
      if (!/duplicate|unique/i.test(error.message)) console.error("[firm-intake] could not record client", error.message);
      return { status: "sent" };
    }
  } else {
    const { error } = await admin()
      .from("firm_clients")
      .update({ email_sent_at: new Date().toISOString(), claim_token_hash: claimTokenHash })
      .eq("normalized_email", email)
      .eq("firm_id", link.firmId)
      .is("joined_at", null);
    if (error) {
      console.error("[firm-intake] could not refresh client", error.message);
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

  const { data: row } = await admin()
    .from("firm_clients")
    .select("id, firm_id, user_id, joined_at, claim_token_hash")
    .eq("normalized_email", email)
    .maybeSingle();
  if (!row) return "ignored";
  if (row.user_id && row.user_id !== user.id) return "ignored";
  // Already joined by this same person (say, the page ran twice): done.
  if (row.joined_at) return row.user_id === user.id ? "joined" : "ignored";
  if (!claimTokenMatches(claimToken, row.claim_token_hash)) return "ignored";

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

  const { error: inviteError } = await admin()
    .from("access_invites")
    .upsert({ normalized_email: email, invited_by: `firm:${row.firm_id}` }, { onConflict: "normalized_email", ignoreDuplicates: true });
  if (inviteError) console.error("[firm-intake] could not add invite", inviteError.message);
  return "joined";
}

/** Called when a client finishes setup. Starts their New badge. */
export async function markFirmClientCompleted(userId: string) {
  await admin()
    .from("firm_clients")
    .update({ completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("completed_at", null);
}

/** The firm a signed-in client joined, for the sharing reminder. */
export async function getClientFirm(userId: string | null | undefined): Promise<{ firmId: string; firmName: string } | null> {
  if (!userId) return null;
  const { data } = await admin()
    .from("firm_clients")
    .select("firm_id, joined_at, firms(name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.joined_at) return null;
  return { firmId: data.firm_id, firmName: data.firms?.name ?? "your law firm" };
}

export async function isJoinedFirmClientEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const { data } = await admin()
    .from("firm_clients")
    .select("joined_at")
    .eq("normalized_email", normalized)
    .maybeSingle();
  return Boolean(data?.joined_at);
}
