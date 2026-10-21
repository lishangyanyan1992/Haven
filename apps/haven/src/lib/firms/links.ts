import { randomBytes } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { FirmIntakeLinkRow } from "@/lib/firms/types";

/**
 * A firm's one shareable intake link. The token is stored as-is so lawyers
 * can copy it any time (see design.md). Replacing the link revokes the old
 * token for good.
 */

function admin() {
  return createSupabaseAdminClient() as any;
}

export function newIntakeToken() {
  return randomBytes(32).toString("base64url");
}

export function intakeUrl(token: string) {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://haven-h1b.com").replace(/\/$/, "");
  return `${site}/i/${token}`;
}

/** The firm's current (not replaced) link. firmId must come from requireFirmMember(). */
export async function getCurrentFirmLink(firmId: string): Promise<FirmIntakeLinkRow | null> {
  const { data } = await admin()
    .from("firm_intake_links")
    .select("*")
    .eq("firm_id", firmId)
    .is("revoked_at", null)
    .maybeSingle();
  return (data as FirmIntakeLinkRow | null) ?? null;
}

export async function setFirmLinkActive(firmId: string, isActive: boolean) {
  const { error } = await admin()
    .from("firm_intake_links")
    .update({ is_active: isActive })
    .eq("firm_id", firmId)
    .is("revoked_at", null);
  if (error) throw new Error(`Could not update the link: ${error.message}`);
}

/** Revoke the current link and make a new active one. */
export async function replaceFirmLink(firmId: string): Promise<FirmIntakeLinkRow> {
  const { error: revokeError } = await admin()
    .from("firm_intake_links")
    .update({ revoked_at: new Date().toISOString(), is_active: false })
    .eq("firm_id", firmId)
    .is("revoked_at", null);
  if (revokeError) throw new Error(`Could not replace the link: ${revokeError.message}`);

  const { data, error } = await admin()
    .from("firm_intake_links")
    .insert({ firm_id: firmId, token: newIntakeToken(), is_active: true })
    .select("*")
    .single();
  if (error) throw new Error(`Could not replace the link: ${error.message}`);
  return data as FirmIntakeLinkRow;
}

export type PublicLinkState =
  | { state: "invalid" }
  | { state: "inactive" }
  | { state: "active"; linkId: string; firmId: string; firmName: string };

/** For the public /i/<token> page. A replaced or unknown token never reveals a firm. */
export async function lookupIntakeToken(token: string): Promise<PublicLinkState> {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return { state: "invalid" };
  const { data } = await admin()
    .from("firm_intake_links")
    .select("id, firm_id, is_active, revoked_at, firms(name)")
    .eq("token", token)
    .maybeSingle();
  if (!data || data.revoked_at) return { state: "invalid" };
  if (!data.is_active) return { state: "inactive" };
  return { state: "active", linkId: data.id, firmId: data.firm_id, firmName: data.firms?.name ?? "your law firm" };
}
