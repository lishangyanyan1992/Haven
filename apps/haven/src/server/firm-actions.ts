"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireFirmMember } from "@/lib/firms/access";
import { firmDocumentUrl } from "@/lib/firms/clients";
import { requestFirmIntake, type IntakeResult } from "@/lib/firms/intake";
import { intakeUrl, replaceFirmLink, setFirmLinkActive } from "@/lib/firms/links";

/**
 * Firm dashboard actions. The firm always comes from requireFirmMember(),
 * never from the caller. evals/firms/isolation.check.ts enforces this.
 */

export async function setFirmLinkActiveAction(isActive: boolean) {
  const membership = await requireFirmMember();
  await setFirmLinkActive(membership.firmId, Boolean(isActive));
  revalidatePath("/firm");
}

export async function replaceFirmLinkAction(): Promise<{ url: string }> {
  const membership = await requireFirmMember();
  const link = await replaceFirmLink(membership.firmId);
  revalidatePath("/firm");
  return { url: intakeUrl(link.token) };
}

export async function openFirmDocumentAction(firmClientId: string, documentId: string): Promise<{ url: string | null }> {
  const membership = await requireFirmMember();
  const url = await firmDocumentUrl(membership.firmId, String(firmClientId), String(documentId));
  return { url };
}

/** Public: the email box on a firm's intake link. */
export async function requestFirmIntakeAction(token: string, email: string): Promise<IntakeResult> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  return requestFirmIntake(String(token ?? ""), String(email ?? ""), ip);
}
