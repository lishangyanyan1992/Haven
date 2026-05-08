import { cache } from "react";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveCrisisEvent } from "@/server/crisis-actions";
import type { Database } from "@/types/database";

export interface CrisisState {
  eventId: string;
  layoffDate: Date;
  activatedAt: Date;
  dayNumber: number;
  daysRemaining: number;
  completedItemKeys: string[];
}

function getDayNumber(activatedAt: Date): number {
  const raw = Math.floor((Date.now() - activatedAt.getTime()) / 86400000) + 1;
  return Math.min(Math.max(raw, 1), 60);
}

export const getCrisisState = cache(async (): Promise<CrisisState | null> => {
  try {
    const supabase = await createSupabaseServerClient();
    const admin = createSupabaseAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const event = await getActiveCrisisEvent();

    if (!event) return null;

    const { data: completions } = await admin
      .from("layoff_checklist_completions")
      .select("item_key")
      .eq("user_id", user.id)
      .eq("event_id", event.id);

    const activatedAt = new Date(event.activated_at);
    const dayNumber = getDayNumber(activatedAt);

    return {
      eventId: event.id,
      layoffDate: new Date(event.layoff_date),
      activatedAt,
      dayNumber,
      daysRemaining: Math.max(60 - dayNumber, 0),
      completedItemKeys: (completions ?? []).map(
        (completion: Pick<Database["public"]["Tables"]["layoff_checklist_completions"]["Row"], "item_key">) =>
          completion.item_key
      ),
    };
  } catch {
    return null;
  }
});
