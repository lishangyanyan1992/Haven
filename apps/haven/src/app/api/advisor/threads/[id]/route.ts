import { NextResponse } from "next/server";
import { z } from "zod";

import { deleteThread, getThreadMessages } from "@/lib/advisor/threads";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const threadIdSchema = z.string().uuid();

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
}

/** Reopen a saved conversation. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!threadIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Unknown conversation." }, { status: 400 });
  }

  try {
    const messages = await getThreadMessages(user.id, id);

    // Scoped by user_id in the query, so a thread belonging to somebody else reads
    // as empty rather than forbidden. 404 here says the same thing without
    // confirming that the id exists at all.
    if (messages.length === 0) {
      return NextResponse.json({ error: "That conversation is no longer available." }, { status: 404 });
    }

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[advisor/threads/:id] read failed:", error);
    return NextResponse.json({ error: "Unable to open that conversation." }, { status: 500 });
  }
}

/**
 * Delete a conversation.
 *
 * A real delete, not an archive flag — messages, citations and feedback go with it
 * via the foreign-key cascade. Somebody clearing their immigration questions out of
 * Haven should get what they asked for.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!threadIdSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Unknown conversation." }, { status: 400 });
  }

  try {
    const deleted = await deleteThread(user.id, id);
    if (!deleted) {
      return NextResponse.json({ error: "That conversation is no longer available." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[advisor/threads/:id] delete failed:", error);
    return NextResponse.json({ error: "Unable to delete that conversation." }, { status: 500 });
  }
}
