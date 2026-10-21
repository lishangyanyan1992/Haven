import { NextResponse } from "next/server";

import { getSnapshotWithSource } from "@/lib/repositories/case-compass";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isInvitedEmail } from "@/lib/access";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isInvitedEmail(user.email))) {
    return NextResponse.json({ error: "Haven is invitation only." }, { status: 403 });
  }

  const { snapshot, contextSource } = await getSnapshotWithSource();

  // An export is a statement of what Haven holds about this person. When the
  // profile could not be loaded, an empty export would claim we hold nothing,
  // and the old fallback exported the demo persona. Neither is true.
  if (contextSource === "unavailable") {
    return NextResponse.json(
      { error: "We couldn't load your data just now. Please try again in a few minutes." },
      { status: 503 }
    );
  }

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
