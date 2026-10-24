"use server";

import { z } from "zod";

import { getOpenFirmContactRequest, sendFirmContactRequest, type ContactRequestResult } from "@/lib/advisor/firm-contact";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The client's side of "Let [firm] know". Firm-side reading and handling of
 * requests lives in firm-actions.ts, behind requireFirmMember().
 */

async function requireUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");
  return user.id;
}

const traceIdSchema = z.string().uuid();

/** Send a contact request for the answer with this trace id. Takes nothing else from the browser. */
export async function sendFirmContactRequestAction(traceId: string): Promise<ContactRequestResult> {
  const parsed = traceIdSchema.safeParse(traceId);
  if (!parsed.success) return { status: "unavailable", reason: "not_found" };
  return sendFirmContactRequest(await requireUserId(), parsed.data);
}

export async function getFirmContactRequestStatusAction(): Promise<{ sentAt: string | null }> {
  return getOpenFirmContactRequest(await requireUserId());
}
