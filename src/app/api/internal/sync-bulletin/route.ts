import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchLatestVisaBulletin } from "@/lib/visa-bulletin-parser";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providedSecret = searchParams.get("secret");
  const expectedSecret = env.VISA_BULLETIN_SYNC_SECRET ?? env.ADVISOR_SOURCE_SYNC_SECRET;

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const bulletin = await fetchLatestVisaBulletin();
    const admin = createSupabaseAdminClient();

    const { error } = await admin.from("visa_bulletin_entries").upsert(
      bulletin.entries.map((entry) => ({
        bulletin_year: entry.bulletinYear,
        bulletin_month: entry.bulletinMonth,
        category: entry.category,
        country: entry.country,
        cutoff_label: entry.cutoffLabel,
        cutoff_date: entry.cutoffDate,
        source_url: entry.sourceUrl
      })),
      { onConflict: "bulletin_year,bulletin_month,category,country" }
    );

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath("/dashboard");
    revalidatePath("/timeline");

    return NextResponse.json({
      syncedAt: new Date().toISOString(),
      bulletinLabel: bulletin.bulletinLabel,
      sourceUrl: bulletin.sourceUrl,
      entriesUpserted: bulletin.entries.length
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync the visa bulletin." },
      { status: 500 }
    );
  }
}
