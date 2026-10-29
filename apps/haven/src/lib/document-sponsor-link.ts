import { normalizePetitions } from "@/lib/petitions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ImmigrantPetition } from "@/types/domain";

/** The user's own green cards, read on the server. Empty when none are saved. */
export async function loadUserPetitions(userId: string): Promise<ImmigrantPetition[]> {
  const { data, error } = await (createSupabaseAdminClient() as any)
    .from("user_profiles")
    .select("deadline_answers")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(`Could not load green cards: ${error.message}`);
  const answers = data?.deadline_answers;
  const record = answers && typeof answers === "object" && !Array.isArray(answers) ? (answers as Record<string, unknown>) : {};
  return normalizePetitions(record.immigrantPetitions);
}

/** The petition id if it is one of this user's green cards, otherwise null. */
export async function ownPetitionId(userId: string, raw: unknown): Promise<string | null> {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) return null;
  const petitions = await loadUserPetitions(userId);
  return petitions.some((p) => p.id === id) ? id : null;
}
