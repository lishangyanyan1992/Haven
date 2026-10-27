import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { User } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const ADMIN_PASSCODE_COOKIE_NAME = "haven_admin_token";

// There is no built-in passcode. Passcode sign-in only works when
// ADMIN_PASSCODE is set to something long enough that guessing it is hopeless;
// otherwise only the emails in ADMIN_EMAILS can get in.
export const MIN_ADMIN_PASSCODE_LENGTH = 16;

export function getAdminPasscode(): string | null {
  const custom = env.ADMIN_PASSCODE?.trim();
  if (!custom || custom.length < MIN_ADMIN_PASSCODE_LENGTH) return null;
  return custom;
}

export function isPasscodeLoginEnabled(): boolean {
  return getAdminPasscode() !== null && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getExpectedAdminToken(): string | null {
  const passcode = getAdminPasscode();
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!passcode || !secret) return null;
  return createHmac("sha256", secret).update(`admin-passcode:${passcode}`).digest("hex");
}

export function isValidPasscode(input: string | null | undefined): boolean {
  if (!input) return false;
  const expected = getAdminPasscode();
  if (!expected) return false;
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
    if (!expected) return false;
    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expected);
    if (tokenBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(tokenBuf, expectedBuf);
  } catch {
    return false;
  }
}

export function getAllowedAdminEmails(): Set<string> {
  // Only ADMIN_EMAILS grants admin access. There is deliberately no fallback
  // to other email lists.
  const raw = env.ADMIN_EMAILS?.trim() ?? "";

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
