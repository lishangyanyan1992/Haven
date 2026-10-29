"use server";

import { revalidatePath } from "next/cache";

import { recordFirmSharedGreenCards } from "@/lib/firms/answers";
import { planPetitionSave } from "@/lib/petition-save";
import { normalizePetitions, type PetitionFieldError } from "@/lib/petitions";
import { refreshDerivedSignals } from "@/lib/profile-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ImmigrantPetition, PetitionEndedReason } from "@/types/domain";

export type SavePetitionsResult =
  | { ok: true; petitions: ImmigrantPetition[] }
  | { ok: false; error: string; fieldErrors?: Record<string, PetitionFieldError[]> };

async function currentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

async function writePetitions(userId: string, input: unknown): Promise<SavePetitionsResult> {
  const admin = createSupabaseAdminClient() as any;
  const { data: row, error: readError } = await admin.from("user_profiles").select("*").eq("id", userId).maybeSingle();
  if (readError || !row) return { ok: false, error: "We couldn't load your profile. Try again in a moment." };

  const plan = planPetitionSave(input, row as Record<string, unknown>);
  if (!plan.ok) return plan;

  const { error: updateError } = await admin.from("user_profiles").update(plan.update).eq("id", userId);
  if (updateError) return { ok: false, error: "We couldn't save your green cards. Try again in a moment." };

  await refreshDerivedSignals(userId);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  revalidatePath("/timeline");
  // The client chose to share green cards with their law firm, if they have one.
  if (!(await recordFirmSharedGreenCards(userId, plan.petitions))) {
    return { ok: false, error: "Your green cards were saved, but your law firm's copy didn't update. Save again to retry." };
  }
  return { ok: true, petitions: plan.petitions };
}

/** Save the whole green card list from settings. */
export async function savePetitionsAction(petitions: unknown): Promise<SavePetitionsResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  return writePetitions(userId, petitions);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const REASONS: PetitionEndedReason[] = ["layoff", "job_change", "withdrawn", "denied", "other"];

/** One-click fix from a dashboard "Check this" note: mark one green card ended. */
export async function endPetitionAction(
  petitionId: string,
  reason: PetitionEndedReason,
  date: string
): Promise<SavePetitionsResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  if (!REASONS.includes(reason) || !ISO_DATE.test(date)) return { ok: false, error: "That date or reason isn't valid." };

  const admin = createSupabaseAdminClient() as any;
  const { data: row, error: readError } = await admin
    .from("user_profiles")
    .select("deadline_answers")
    .eq("id", userId)
    .maybeSingle();
  if (readError || !row) return { ok: false, error: "We couldn't load your profile. Try again in a moment." };
  const current = normalizePetitions((row?.deadline_answers as Record<string, unknown> | null)?.immigrantPetitions);
  if (!current.some((p) => p.id === petitionId)) return { ok: false, error: "That green card wasn't found." };

  const next = current.map((p) =>
    p.id === petitionId
      ? {
          ...p,
          endedReason: reason,
          endedDate: date
        }
      : p
  );
  const result = await writePetitions(userId, next);
  // Another green card failing its checks can't be fixed from the dashboard note.
  if (!result.ok && result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
    return {
      ...result,
      error: "Another green card has a date or step that needs fixing. Open Settings, then Green cards, to fix it."
    };
  }
  return result;
}
