"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  ADMIN_PASSCODE_COOKIE_NAME,
  getAdminUser,
  getExpectedAdminToken,
  isPasscodeLoginEnabled,
  isValidPasscode
} from "@/lib/admin-auth";
import { reserveAdminPasscodeAttempt } from "@/lib/admin-passcode-limit";
import { executeVisaBulletinSync } from "@/lib/visa-bulletin-sync";

export type VerifyAdminPasscodeState = {
  status: "idle" | "error";
  error?: string;
};

export async function verifyAdminPasscodeAction(
  _prevState: VerifyAdminPasscodeState,
  formData: FormData
): Promise<VerifyAdminPasscodeState> {
  const passcode = String(formData.get("passcode") ?? "");
  const rawRedirect = String(formData.get("redirectTo") ?? "/admin").trim();
  const redirectTo = rawRedirect.startsWith("/admin") ? rawRedirect : "/admin";

  if (!isPasscodeLoginEnabled()) {
    return {
      status: "error",
      error: "Passcode sign-in is turned off. Sign in with an admin account instead."
    };
  }

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";

  const attempt = await reserveAdminPasscodeAttempt(ip);
  if (!attempt.allowed) {
    return {
      status: "error",
      error: "Too many wrong tries. Please wait up to an hour and try again, or sign in with an admin account."
    };
  }

  const token = getExpectedAdminToken();
  if (!isValidPasscode(passcode) || !token) {
    // The attempt stays recorded as a wrong guess.
    return {
      status: "error",
      error: "Incorrect passcode. Please try again."
    };
  }

  await attempt.forget();

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_PASSCODE_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });

  revalidatePath("/admin");
  redirect(redirectTo);
}

export async function lockAdminAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_PASSCODE_COOKIE_NAME);
  revalidatePath("/admin");
  redirect("/admin");
}

export type SyncBulletinActionResponse = {
  success: boolean;
  message: string;
  bulletinLabel?: string;
  entriesUpserted?: number;
  syncedAt?: string;
};

export async function syncVisaBulletinAction(): Promise<SyncBulletinActionResponse> {
  const adminUser = await getAdminUser();
  if (!adminUser) {
    return {
      success: false,
      message: "Unauthorized: Admin access required."
    };
  }

  const result = await executeVisaBulletinSync({ sendEmails: true });

  if (!result.success) {
    const detail = result.hardFailures && result.hardFailures.length > 0
      ? result.hardFailures.join("; ")
      : result.error ?? "Failed to sync bulletin.";
    return {
      success: false,
      message: `Bulletin sync failed: ${detail}`
    };
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");

  return {
    success: true,
    message: `Successfully synced ${result.bulletinLabel} (${result.entriesUpserted} entries).`,
    bulletinLabel: result.bulletinLabel,
    entriesUpserted: result.entriesUpserted,
    syncedAt: result.syncedAt
  };
}
