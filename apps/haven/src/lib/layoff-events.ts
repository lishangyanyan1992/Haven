/**
 * Opening a layoff record, from either surface that can open one.
 *
 * A `layoff_events` row is the product's only statement of *when* somebody lost
 * their job, and everything downstream — the 60-day countdown on the dashboard,
 * the War Room checklist, and now the Advisor's answers — reads it. It was
 * previously written from exactly one place, the crisis-mode button. The Advisor
 * can now open one too, when somebody says "I was laid off on August 3" in chat,
 * which is how most people report it.
 *
 * Two writers means the insert has to live in one place. This is that place. Two
 * copies of an insert that seeds a legal deadline would drift the way four copies
 * of the layoff condition drifted in service.ts, and here the drift would be a
 * row that the War Room does not recognise as its own.
 *
 * WHY OPENING ONE IS A REAL SIDE EFFECT
 *
 * An open row is what `getActiveCrisisEvent` looks for, so writing one turns on
 * crisis mode across the product. That is the intended behaviour — somebody who
 * has just said they were laid off wants the countdown — but it is a visible
 * change to their account made from a sentence they typed, so the Advisor
 * announces every one of these in the same reply. See renderProfileUpdateNotice.
 *
 * An existing open row is never overwritten. Somebody who activated crisis mode
 * from the form has given a considered date; a date parsed from a sentence should
 * not silently replace it. Correcting a wrong date stays a deliberate act in the
 * profile, where it can be seen before it is saved.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface OpenLayoffEvent {
  id: string;
  layoffDate: string;
  activatedAt: string;
}

export async function getOpenLayoffEvent(userId: string): Promise<OpenLayoffEvent | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("layoff_events")
    .select("id, layoff_date, activated_at")
    .eq("user_id", userId)
    .is("resolved_at", null)
    .order("layoff_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return { id: data.id, layoffDate: data.layoff_date, activatedAt: data.activated_at };
}

/**
 * Open a layoff record, or return the one already open.
 *
 * `layoffDate` is a plain ISO date. The employer and visa type are copied from
 * the profile so the row records what was true at the time, which is the whole
 * point of storing them on the event rather than reading the profile later — by
 * the time somebody resolves a layoff, their employer has changed.
 */
export async function openLayoffEvent(
  userId: string,
  layoffDate: string
): Promise<{ event: OpenLayoffEvent; created: boolean } | null> {
  const existing = await getOpenLayoffEvent(userId);
  if (existing) return { event: existing, created: false };

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("employer_name, visa_type")
    .eq("id", userId)
    .maybeSingle();

  const { data, error } = await admin
    .from("layoff_events")
    .insert({
      user_id: userId,
      layoff_date: layoffDate,
      employer_at_layoff: profile?.employer_name ?? null,
      visa_type_at_layoff: profile?.visa_type ?? null,
      activated_at: new Date().toISOString()
    })
    .select("id, layoff_date, activated_at")
    .single();

  if (error || !data) return null;
  return { event: { id: data.id, layoffDate: data.layoff_date, activatedAt: data.activated_at }, created: true };
}
