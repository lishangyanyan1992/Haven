import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { INVITE_ONLY_PATH, OWNER_EMAIL } from "@/lib/access-constants";

export { INVITE_ONLY_PATH, OWNER_EMAIL };

/**
 * Haven is invitation only. The owner always gets in; everyone else needs a
 * row in access_invites. Any lookup failure keeps the door shut.
 */
export function normalizeEmail(email: string | null | undefined) {
  return String(email ?? "").trim().toLowerCase();
}

export function isOwnerEmail(email: string | null | undefined) {
  return normalizeEmail(email) === OWNER_EMAIL;
}

export async function isInvitedEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (isOwnerEmail(normalized)) return true;

  try {
    const admin = createSupabaseAdminClient() as any;
    const { data, error } = await admin
      .from("access_invites")
      .select("normalized_email")
      .eq("normalized_email", normalized)
      .maybeSingle();
    if (error) {
      console.error("[access] invite lookup failed", error.message);
      return false;
    }
    return Boolean(data);
  } catch (error) {
    console.error("[access] invite lookup failed", error);
    return false;
  }
}
