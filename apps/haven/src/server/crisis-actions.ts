"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { openLayoffEvent } from "@/lib/layoff-events";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ResolutionType = "new_job" | "change_status" | "left_country" | "dismissed";
type ActiveLayoffEventRow = Pick<
  Database["public"]["Tables"]["layoff_events"]["Row"],
  "id" | "activated_at" | "layoff_date"
>;
type LayoffChecklistCompletionInsert = Database["public"]["Tables"]["layoff_checklist_completions"]["Insert"];

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return { supabase, user };
}

function getElapsedCrisisDays(activatedAtIso: string) {
  return Math.floor((Date.now() - new Date(activatedAtIso).getTime()) / 86400000) + 1;
}

function hasCrisisExpired(activatedAtIso: string) {
  return getElapsedCrisisDays(activatedAtIso) > 60;
}

function revalidateCrisisSurfaces() {
  revalidatePath("/dashboard");
  revalidatePath("/planner");
  revalidatePath("/timeline");
  revalidatePath("/community");
  revalidatePath("/profile/community");
  revalidatePath("/inbox");
  revalidatePath("/settings");
  revalidatePath("/advisor");
}

export async function getActiveCrisisEvent(): Promise<ActiveLayoffEventRow | null> {
  const { user } = await requireUser();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("layoff_events")
    .select("id, activated_at, layoff_date")
    .eq("user_id", user.id)
    .is("resolved_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load crisis mode: ${error.message}`);
  }

  if (data && hasCrisisExpired(data.activated_at)) {
    const { error: resolveError } = await admin
      .from("layoff_events")
      .update({
        resolved_at: new Date().toISOString(),
        resolution_type: "dismissed",
      })
      .eq("id", data.id);

    if (resolveError) {
      throw new Error(`Failed to expire crisis mode: ${resolveError.message}`);
    }

    revalidateCrisisSurfaces();
    return null;
  }

  return data;
}

export async function activateCrisisMode(layoffDateInput: Date | string): Promise<{ eventId: string }> {
  const { user } = await requireUser();
  const admin = createSupabaseAdminClient();
  const activeEvent = await getActiveCrisisEvent();
  const layoffDate = layoffDateInput instanceof Date ? layoffDateInput : new Date(`${layoffDateInput}T12:00:00`);

  if (activeEvent) {
    return { eventId: activeEvent.id };
  }

  // The insert itself lives in lib/layoff-events so the Advisor can open the same
  // kind of row from a sentence typed in chat. One writer, two callers.
  const opened = await openLayoffEvent(user.id, layoffDate.toISOString().split("T")[0]);

  if (!opened) {
    throw new Error("Failed to activate crisis mode.");
  }

  revalidateCrisisSurfaces();

  return { eventId: opened.event.id };
}

export async function resolveCrisisMode(resolution: ResolutionType): Promise<void> {
  const { user } = await requireUser();
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from("layoff_events")
    .update({
      resolved_at: new Date().toISOString(),
      resolution_type: resolution,
    })
    .eq("user_id", user.id)
    .is("resolved_at", null);

  if (error) {
    throw new Error(`Failed to resolve crisis mode: ${error.message}`);
  }

  revalidateCrisisSurfaces();
}

export async function resolveCrisisModeFromForm(formData: FormData): Promise<void> {
  const resolution = String(formData.get("resolution") ?? "dismissed") as ResolutionType;
  await resolveCrisisMode(resolution);
}

export async function toggleChecklistItem(
  eventId: string,
  itemKey: string,
  completed: boolean
): Promise<void> {
  const { user } = await requireUser();
  const admin = createSupabaseAdminClient();

  if (completed) {
    const payload: LayoffChecklistCompletionInsert = {
      user_id: user.id,
      event_id: eventId,
      item_key: itemKey,
      completed_at: new Date().toISOString(),
    };
    const { error } = await admin.from("layoff_checklist_completions").upsert(payload);

    if (error) {
      throw new Error(`Failed to update checklist item: ${error.message}`);
    }
  } else {
    const { error } = await admin
      .from("layoff_checklist_completions")
      .delete()
      .eq("event_id", eventId)
      .eq("item_key", itemKey);

    if (error) {
      throw new Error(`Failed to update checklist item: ${error.message}`);
    }
  }

  revalidatePath("/planner");
}
