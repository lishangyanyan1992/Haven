"use server";

import { revalidatePath } from "next/cache";

import { getAdminUser } from "@/lib/admin-auth";
import { executeVisaBulletinSync } from "@/lib/visa-bulletin-sync";

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
