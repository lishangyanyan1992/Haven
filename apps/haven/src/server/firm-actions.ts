"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireFirmMember } from "@/lib/firms/access";
import { firmDocumentUrl } from "@/lib/firms/clients";
import { resetDemoFirm } from "@/lib/firms/demo";
import { claimFirmInvite, requestFirmIntake, type IntakeResult } from "@/lib/firms/intake";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { intakeUrl, replaceFirmLink, setFirmLinkActive } from "@/lib/firms/links";
import { saveFirmIntakeQuestions, validateIntakeQuestionList } from "@/lib/firms/intake-questions";
import { saveFirmRequiredDocuments } from "@/lib/firms/required-documents";
import { validateRequiredDocumentList } from "@/lib/document-vault";
import type { IntakeQuestionItem, RequiredDocumentItem } from "@/lib/firms/types";

/**
 * Firm dashboard actions. The firm always comes from requireFirmMember(),
 * never from the caller. evals/firms/isolation.check.ts enforces this.
 */

export async function saveFirmRequiredDocumentsAction(
  items: unknown
): Promise<{ ok: true; items: RequiredDocumentItem[] } | { ok: false; error: string }> {
  const membership = await requireFirmMember();
  const validation = validateRequiredDocumentList(items);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const saved = await saveFirmRequiredDocuments(membership.firmId, items);
  revalidatePath("/firm");
  revalidatePath("/documents");
  revalidatePath("/onboarding");
  return { ok: true, items: saved };
}

export async function saveFirmIntakeQuestionsAction(
  items: unknown
): Promise<{ ok: true; items: IntakeQuestionItem[] } | { ok: false; error: string }> {
  const membership = await requireFirmMember();
  const validation = validateIntakeQuestionList(items);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const saved = await saveFirmIntakeQuestions(membership.firmId, items);
  revalidatePath("/firm");
  revalidatePath("/onboarding");
  return { ok: true, items: saved };
}

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

/**
 * Resets demo firm clients and dates. Strictly rejected for non-demo firms.
 */
export async function resetDemoFirmAction(): Promise<{ ok: boolean; count: number }> {
  const membership = await requireFirmMember();
  if (!membership.isDemo) {
    throw new Error("Demo reset is only available for demo accounts.");
  }
  const result = await resetDemoFirm(membership.firmId, new Date());
  revalidatePath("/firm");
  return { ok: true, count: result.count };
}

/**
 * The set-password page opened from a firm's intake email. Joins the
 * signed-in account to that firm if it holds the email's one-time code.
 */
export async function claimFirmInviteAction(claimToken: string): Promise<{ joined: boolean }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { joined: false };
  const result = await claimFirmInvite(user, String(claimToken ?? ""));
  return { joined: result === "joined" };
}

/** Public: the email box on a firm's intake link. */
export async function requestFirmIntakeAction(token: string, email: string): Promise<IntakeResult> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  return requestFirmIntake(String(token ?? ""), String(email ?? ""), ip);
}
