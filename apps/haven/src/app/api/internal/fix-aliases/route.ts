import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const expectedSecret = env.ADVISOR_SOURCE_SYNC_SECRET;

  if (!expectedSecret) {
    return NextResponse.json({ error: "endpoint_not_configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const providedSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!providedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const correctDomain = env.EMAIL_INGEST_DOMAIN ?? "import.haven-h1b.com";

  const admin = createSupabaseAdminClient() as any;

  // Fetch all aliases
  const { data: aliases, error: fetchError } = await admin
    .from("email_aliases")
    .select("id, alias, user_id");

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  const toFix = (aliases ?? []).filter(
    (row: { alias: string }) => !row.alias.endsWith(`@${correctDomain}`)
  );

  if (toFix.length === 0) {
    return NextResponse.json({ status: "nothing_to_fix", correctDomain });
  }

  const results = await Promise.all(
    toFix.map(async (row: { id: string; alias: string; user_id: string }) => {
      const localPart = row.alias.split("@")[0];
      const newAlias = `${localPart}@${correctDomain}`;

      const { error } = await admin
        .from("email_aliases")
        .update({ alias: newAlias })
        .eq("id", row.id);

      return { userId: row.user_id, old: row.alias, new: newAlias, error: error?.message ?? null };
    })
  );

  return NextResponse.json({ status: "done", fixed: results });
}
