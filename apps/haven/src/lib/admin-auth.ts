import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const DEFAULT_ADMIN_PASSCODE = "901008";
export const ADMIN_PASSCODE_COOKIE_NAME = "haven_admin_token";

export function getAdminPasscode(): string {
  const custom = env.ADMIN_PASSCODE?.trim();
  return custom && custom.length > 0 ? custom : DEFAULT_ADMIN_PASSCODE;
}

export function getExpectedAdminToken(): string {
  const passcode = getAdminPasscode();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "haven-admin-secret-salt";
  return createHmac("sha256", secret).update(`admin-passcode:${passcode}`).digest("hex");
}

export function isValidPasscode(input: string | null | undefined): boolean {
  if (!input) return false;
  const expected = getAdminPasscode();
  const inputBuf = Buffer.from(input.trim());
  const expectedBuf = Buffer.from(expected);
  if (inputBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(inputBuf, expectedBuf);
}

export async function hasAdminPasscodeCookie(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_PASSCODE_COOKIE_NAME)?.value;
    if (!token) return false;
    const expected = getExpectedAdminToken();
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expected);
    if (tokenBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(tokenBuf, expectedBuf);
  } catch {
    return false;
  }
}

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

export type AdminUserSession = {
  user?: User;
  email: string;
  isPasscodeAdmin: boolean;
};

export async function hasAdminAccess(): Promise<boolean> {
  if (await hasAdminPasscodeCookie()) {
    return true;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    return Boolean(user?.email && isAdminEmail(user.email));
  } catch {
    return false;
  }
}

export async function getAdminUser(): Promise<AdminUserSession | null> {
  const isPasscode = await hasAdminPasscodeCookie();

  let user: User | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const res = await supabase.auth.getUser();
    user = res.data.user;
  } catch {
    // ignore
  }

  if (isPasscode) {
    return {
      user: user ?? undefined,
      email: user?.email ? user.email.toLowerCase() : "Admin",
      isPasscodeAdmin: true
    };
  }

  if (user && user.email && isAdminEmail(user.email)) {
    return {
      user,
      email: user.email.toLowerCase(),
      isPasscodeAdmin: false
    };
  }

  return null;
}

export async function requireAdminUser(redirectTo = "/admin"): Promise<AdminUserSession> {
  const adminUser = await getAdminUser();

  if (!adminUser) {
    redirect(redirectTo);
  }

  return adminUser;
}
