import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { isOwnerEmail, normalizeEmail } from "@/lib/access";
import { lookupIntakeToken } from "@/lib/firms/links";
import type { FirmClientRow } from "@/lib/firms/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Joining a firm through its intake link. Two steps (design.md):
 *
 * 1. requestFirmIntake: the visitor enters an email. Haven records a pending
 *    firm client and emails that address. Nothing is granted yet.
 * 2. claimFirmInvite: on sign-in, someone holding that mailbox is attached
 *    to the firm and added to the invite list.
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

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export type IntakeResult = { status: "sent" } | { status: "invalid_email" } | { status: "invalid_link" } | { status: "inactive_link" };

/** What to do with an email entered on a link. Pure, so it can be checked. */
export type IntakeDecision =
  | { action: "ignore"; reason: "owner" | "lawyer" | "other_firm" | "rate_limited" }
  | { action: "invite_new" }
  | { action: "resend_same_firm" };

export function decideIntake(input: {
  email: string;
  linkFirmId: string;
  isLawyer: boolean;
  existingClient: Pick<FirmClientRow, "firm_id"> | null;
  counts: { email: number; visitor: number; link: number };
}): IntakeDecision {
  if (isOwnerEmail(input.email)) return { action: "ignore", reason: "owner" };
  if (
    input.counts.email >= INTAKE_LIMITS.perEmailPerHour ||
    input.counts.visitor >= INTAKE_LIMITS.perVisitorPerHour ||
    input.counts.link >= INTAKE_LIMITS.perLinkPerDay
  ) {
    return { action: "ignore", reason: "rate_limited" };
  }
  if (input.isLawyer) return { action: "ignore", reason: "lawyer" };
  if (input.existingClient && input.existingClient.firm_id !== input.linkFirmId) return { action: "ignore", reason: "other_firm" };
  if (input.existingClient) return { action: "resend_same_firm" };
  return { action: "invite_new" };
}

async function countSince(column: "normalized_email" | "ip_hash" | "link_id", value: string, sinceMs: number) {
  const since = new Date(Date.now() - sinceMs).toISOString();
  const { count } = await admin()
    .from("firm_intake_sends")
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .gte("created_at", since);
  return count ?? 0;
}

/**
 * Email the address a way in: a new-account invite, or, if the address
 * already has an account, a password-reset link (which also signs them in).
 */
async function sendSignUpEmail(email: string) {
  const redirectTo = `${siteUrl()}/auth/callback?next=/reset-password`;
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

  const ipHash = hashVisitor(visitorIp || "unknown");
  const [emailCount, visitorCount, linkCount, lawyer, existing] = await Promise.all([
    countSince("normalized_email", email, 60 * 60 * 1000),
    countSince("ip_hash", ipHash, 60 * 60 * 1000),
    countSince("link_id", link.linkId, 24 * 60 * 60 * 1000),
    admin().from("firm_members").select("user_id").eq("email", email).maybeSingle(),
    admin().from("firm_clients").select("firm_id").eq("normalized_email", email).maybeSingle()
  ]);

  const decision = decideIntake({
    email,
    linkFirmId: link.firmId,
    isLawyer: Boolean(lawyer.data),
    existingClient: existing.data ?? null,
    counts: { email: emailCount, visitor: visitorCount, link: linkCount }
  });

  if (decision.action === "ignore") return { status: "sent" };

  // Log before sending so a slow send can't be used to slip past the limits.
  await admin().from("firm_intake_sends").insert({ link_id: link.linkId, normalized_email: email, ip_hash: ipHash });

  if (decision.action === "invite_new") {
    const { error } = await admin()
      .from("firm_clients")
      .insert({ firm_id: link.firmId, normalized_email: email, link_id: link.linkId });
    // A unique clash means another request just claimed this email. Treat it as handled.
    if (error && !/duplicate|unique/i.test(error.message)) {
      console.error("[firm-intake] could not record client", error.message);
      return { status: "sent" };
    }
  } else {
    await admin()
      .from("firm_clients")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("normalized_email", email)
      .eq("firm_id", link.firmId);
  }

  await sendSignUpEmail(email);
  return { status: "sent" };
}

/**
 * On sign-in: if this confirmed email has a pending firm invite, attach the
 * account to that firm and put the email on the invite list. Must run before
 * the invite check, because this is what creates the invite.
 */
export async function claimFirmInvite(user: { id: string; email?: string | null; email_confirmed_at?: string | null }) {
  const email = normalizeEmail(user.email);
  if (!email || !user.email_confirmed_at) return;

  const { data: row } = await admin()
    .from("firm_clients")
    .select("id, firm_id, user_id, joined_at")
    .eq("normalized_email", email)
    .maybeSingle();
  if (!row) return;
  if (row.user_id && row.user_id !== user.id) return;

  if (!row.user_id || !row.joined_at) {
    const { error } = await admin()
      .from("firm_clients")
      .update({ user_id: user.id, joined_at: row.joined_at ?? new Date().toISOString() })
      .eq("id", row.id);
    if (error) {
      console.error("[firm-intake] could not attach client", error.message);
      return;
    }
  }

  const { error: inviteError } = await admin()
    .from("access_invites")
    .upsert({ normalized_email: email, invited_by: `firm:${row.firm_id}` }, { onConflict: "normalized_email", ignoreDuplicates: true });
  if (inviteError) console.error("[firm-intake] could not add invite", inviteError.message);
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
