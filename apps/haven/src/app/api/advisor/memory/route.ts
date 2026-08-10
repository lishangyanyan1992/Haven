import { NextResponse } from "next/server";
import { z } from "zod";

import { forgetFact, listFacts } from "@/lib/advisor/memory";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Everything the Advisor remembers about this person.
 *
 * This endpoint is the feature's honesty mechanism, not a nice-to-have. A fact the
 * user knows they gave is helpful; one they did not realise was kept is
 * unsettling, and on immigration history that is a trust failure. If it is
 * remembered, it is listed here.
 */
export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ facts: await listFacts(user.id) });
  } catch (error) {
    console.error("[advisor/memory] list failed:", error);
    return NextResponse.json({ error: "Unable to load what Haven remembers." }, { status: 500 });
  }
}

const forgetSchema = z.object({ factId: z.string().uuid() });

/** Forget one fact. */
export async function DELETE(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = forgetSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Unknown item." }, { status: 400 });
  }

  try {
    const forgotten = await forgetFact(user.id, body.data.factId);
    if (!forgotten) {
      return NextResponse.json({ error: "That is no longer remembered." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[advisor/memory] forget failed:", error);
    return NextResponse.json({ error: "Unable to remove that." }, { status: 500 });
  }
}
