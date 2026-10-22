import { redirect } from "next/navigation";

import { SIGNED_IN_HOME } from "@/lib/archived-routes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FirmMemberRow, FirmRow } from "@/lib/firms/types";

/**
 * Who is a lawyer, and at which firm.
 *
 * requireFirmMember() is the ONLY place a firm id may come from for firm
 * pages, actions and document links. Never take a firm id from the URL, a
 * form or the client. evals/firms/isolation.check.ts enforces this.
 */

function admin() {
  return createSupabaseAdminClient() as any;
}

export type FirmMembership = { firmId: string; firmName: string; userId: string; email: string };

export async function getFirmMembership(userId: string | null | undefined): Promise<FirmMembership | null> {
  if (!userId) return null;
  const { data, error } = await admin()
    .from("firm_members")
    .select("firm_id, user_id, email, firms(name)")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[firms] membership lookup failed", error.message);
    return null;
  }
  if (!data) return null;
  const row = data as FirmMemberRow & { firms: Pick<FirmRow, "name"> | null };
  return { firmId: row.firm_id, firmName: row.firms?.name ?? "Your firm", userId: row.user_id, email: row.email };
}

/** For firm pages and actions. Signed out → sign in; not a lawyer → home. */
export async function requireFirmMember(redirectTo = "/firm"): Promise<FirmMembership> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);

  const membership = await getFirmMembership(user.id);
  if (!membership) redirect(SIGNED_IN_HOME);
  return membership;
}

export async function isFirmLawyerEmail(email: string) {
  const { data } = await admin().from("firm_members").select("user_id").eq("email", email).maybeSingle();
  return Boolean(data);
}
