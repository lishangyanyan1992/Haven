import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { SIGNED_IN_HOME } from "@/lib/archived-routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function getAllowedAdminEmails(): Set<string> {
  const adminEmails = env.ADMIN_EMAILS?.trim();
  const raw = adminEmails && adminEmails.length > 0
    ? adminEmails
    : env.COMMUNITY_IMPORT_REVIEWER_EMAILS ?? "";

  return new Set(
    raw
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = getAllowedAdminEmails();
  return allowed.size > 0 && allowed.has(email.trim().toLowerCase());
}

export async function getAdminUser(): Promise<{ user: User; email: string } | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return null;
  }

  if (!isAdminEmail(user.email)) {
    return null;
  }

  return { user, email: user.email.toLowerCase() };
}

export async function requireAdminUser(redirectTo = "/admin"): Promise<{ user: User; email: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !user.email) {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  if (!isAdminEmail(user.email)) {
    redirect(`/login?error=admin_access_required&redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return { user, email: user.email.toLowerCase() };
}
