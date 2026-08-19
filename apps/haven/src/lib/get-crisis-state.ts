/**
 * The countdown, for every surface that shows one.
 *
 * This counted from `activated_at` — the moment somebody pressed the button —
 * rather than from their last day of employment. Nobody presses the button the
 * hour they are let go, so the number was wrong for everyone, and wrong in the
 * dangerous direction: a person laid off thirty days before activating was shown
 * "Day 1 of 60, 59 days remaining" when they had thirty. It also clamped to 60,
 * so anybody past their window read "Day 60" indefinitely instead of being told
 * it had passed.
 *
 * It was invisible until the Advisor started counting too, from the layoff date,
 * and the two surfaces began contradicting each other on the same screen.
 *
 * Both now use `readGracePeriod`. One calculator, so the banner, the planner and
 * the answer cannot disagree — which was the whole point of putting the layoff
 * date in one table.
 */
import { cache } from "react";

import { readGracePeriod } from "@/lib/advisor/grace-period";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveCrisisEvent } from "@/server/crisis-actions";
import type { Database } from "@/types/database";

export interface CrisisState {
  eventId: string;
  layoffDate: Date;
  activatedAt: Date;
  /** Days since the last day of employment. Can exceed 60 — see `expired`. */
  dayNumber: number;
  /** Zero once the window has passed, never negative. */
  daysRemaining: number;
  /**
   * The 60-day ceiling has passed.
   *
   * Surfaced rather than folded into a clamped day number, because "Day 60 of
   * 60" and "this passed three weeks ago" call for completely different copy, and
   * the person in the second case is the one who most needs to be told plainly.
   */
  expired: boolean;
  completedItemKeys: string[];
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
    const grace = readGracePeriod(event.layoff_date);

    return {
      eventId: event.id,
      layoffDate: new Date(`${event.layoff_date}T00:00:00Z`),
      activatedAt,
      dayNumber: grace?.dayNumber ?? 0,
      daysRemaining: Math.max(grace?.daysRemaining ?? 0, 0),
      expired: grace?.expired ?? false,
      completedItemKeys: (completions ?? []).map(
        (completion: Pick<Database["public"]["Tables"]["layoff_checklist_completions"]["Row"], "item_key">) =>
          completion.item_key
      ),
    };
  } catch {
    return null;
  }
});
