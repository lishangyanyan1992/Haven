import { hasSupabaseEnv } from "@/lib/env";
import { havenSnapshot } from "@/lib/repositories/mock-data";
import { supabaseHavenRepository } from "@/lib/repositories/supabase-case-compass";

export async function getSnapshot() {
  if (hasSupabaseEnv) {
    try {
      return await supabaseHavenRepository.getSnapshot();
    } catch {
      return havenSnapshot;
    }
  }

  return havenSnapshot;
}
