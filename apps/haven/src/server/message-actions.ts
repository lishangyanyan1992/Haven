"use server";

import { revalidatePath } from "next/cache";

import {
  acknowledgeChatVisibility,
  getChatVisibility,
  type ChatVisibility
} from "@/lib/advisor/firm-visibility";
import { markClientConversationRead, sendClientMessage, type ClientSendResult } from "@/lib/firms/client-messages";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The client's side of messaging their lawyer, and of agreeing that their firm
 * sees their AI chats. The signed-in user decides everything; a firm id from
 * the browser only picks among that user's own firms.
 */

async function requireUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");
  return user.id;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sendClientMessageAction(input: { firmId: string; body: string }): Promise<ClientSendResult> {
  if (!uuidPattern.test(String(input.firmId ?? ""))) return { status: "not_found" };
  const result = await sendClientMessage(await requireUserId(), { firmId: input.firmId, body: input.body });
  if (result.status === "sent") revalidatePath("/dashboard");
  return result;
}

export async function markClientMessagesReadAction(firmId: string): Promise<{ ok: boolean }> {
  if (!uuidPattern.test(String(firmId ?? ""))) return { ok: false };
  return { ok: await markClientConversationRead(await requireUserId(), firmId) };
}

export async function getChatVisibilityAction(): Promise<ChatVisibility> {
  return getChatVisibility(await requireUserId());
}

export async function acknowledgeChatVisibilityAction(): Promise<ChatVisibility> {
  return acknowledgeChatVisibility(await requireUserId());
}
