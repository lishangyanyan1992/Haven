import { revalidatePath } from "next/cache";

import { recordFirmSharedGreenCards } from "@/lib/firms/answers";
import { planPetitionSave } from "@/lib/petition-save";
import { normalizePetitions, seedPetitionsFromLegacyProfile, type PetitionFieldError } from "@/lib/petitions";
import { mapProfileRow } from "@/lib/profile-mapper";
import { refreshDerivedSignals } from "@/lib/profile-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ImmigrantPetition } from "@/types/domain";

/** Refresh pages after a save. Outside a request (the background reader) there is nothing to refresh. */
export function safeRevalidate(...paths: string[]) {
  for (const path of paths) {
    try {
      revalidatePath(path);
    } catch {
      // Not in a request.
    }
  }
}

export type SavePetitionsResult =
  | { ok: true; petitions: ImmigrantPetition[] }
  | { ok: false; error: string; fieldErrors?: Record<string, PetitionFieldError[]> };

/**
 * The one way a green card list is saved: checked, written with the flat
 * profile fields kept in line, signals refreshed, and the firm's copy updated.
 * Used by the Settings editor and by details read from documents.
 */
export async function writePetitions(
  userId: string,
  /** The whole list, or a function that builds it from the list as saved right now. */
  input: unknown | ((current: ImmigrantPetition[]) => unknown),
  options: { onlyCheck?: string[] } = {}
): Promise<SavePetitionsResult> {
  const admin = createSupabaseAdminClient() as any;
  const { data: row, error: readError } = await admin.from("user_profiles").select("*").eq("id", userId).maybeSingle();
  if (readError || !row) return { ok: false, error: "We couldn't load your profile. Try again in a moment." };
  if (typeof input === "function") {
    const profile = mapProfileRow(row);
    const existingPetitions = seedPetitionsFromLegacyProfile(profile);
    input = (input as (current: ImmigrantPetition[]) => unknown)(existingPetitions);
  }

  const plan = planPetitionSave(input, row as Record<string, unknown>, options);
  if (!plan.ok) return plan;

  const { error: updateError } = await admin.from("user_profiles").update(plan.update).eq("id", userId);
  if (updateError) return { ok: false, error: "We couldn't save your green cards. Try again in a moment." };

  await refreshDerivedSignals(userId);
  safeRevalidate("/dashboard", "/profile", "/settings", "/timeline");
  // The client chose to share green cards with their law firm, if they have one.
  const savedPriorityDate =
    typeof (plan.update as Record<string, unknown>).priority_date === "string"
      ? ((plan.update as Record<string, unknown>).priority_date as string)
      : null;
  if (!(await recordFirmSharedGreenCards(userId, plan.petitions, savedPriorityDate))) {
    return { ok: false, error: "Your green cards were saved, but your law firm's copy didn't update. Save again to retry." };
  }
  return { ok: true, petitions: plan.petitions };
}
