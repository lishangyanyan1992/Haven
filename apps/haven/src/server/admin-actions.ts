"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  ADMIN_PASSCODE_COOKIE_NAME,
  getAdminUser,
  getExpectedAdminToken,
  isValidPasscode
} from "@/lib/admin-auth";
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

  if (!isValidPasscode(passcode)) {
    return {
      status: "error",
      error: "Incorrect passcode. Please try again."
    };
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_PASSCODE_COOKIE_NAME, getExpectedAdminToken(), {
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
