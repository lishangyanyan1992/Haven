import { NextResponse } from "next/server";

import { getSnapshot } from "@/lib/repositories/case-compass";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snapshot = await getSnapshot();

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    profile: {
      visaType: snapshot.profile.visaType,
      countryOfBirth: snapshot.profile.countryOfBirth,
      primaryGoal: snapshot.profile.primaryGoal
    },
    counts: {
      timelineEvents: snapshot.timelineEvents.length,
      communitySpaces: snapshot.cohorts.length + 1,
      vaultDocuments: snapshot.documents.length,
      emailIngestRecords: snapshot.emailInbox.length
    }
  });
}
