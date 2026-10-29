"use server";

import { revalidatePath } from "next/cache";

import { forgetRemovedPetitions, petitionEdits, recordPersonEdits } from "@/lib/field-sources/person";
import { writePetitions, type SavePetitionsResult } from "@/lib/petition-write";
import { normalizePetitions } from "@/lib/petitions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PetitionEndedReason } from "@/types/domain";

export type { SavePetitionsResult };

async function currentUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Save the whole green card list from settings. */
export async function savePetitionsAction(petitions: unknown): Promise<SavePetitionsResult> {
  const userId = await currentUserId();
  if (!userId) return { ok: false, error: "Please sign in again." };
  const { data: row } = await (createSupabaseAdminClient() as any)
    .from("user_profiles")
    .select("deadline_answers")
    .eq("id", userId)
    .maybeSingle();
  const before = normalizePetitions((row?.deadline_answers as Record<string, unknown> | null)?.immigrantPetitions);
  const result = await writePetitions(userId, petitions);
  if (result.ok) {
    // Changes to values read from documents are labeled as the person's; removed green cards lose their labels.
    const { edits, removed } = petitionEdits(before, result.petitions);
    await recordPersonEdits(userId, edits);
    await forgetRemovedPetitions(userId, removed);
  }
  return result;
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
