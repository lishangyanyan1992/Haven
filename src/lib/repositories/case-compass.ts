import { cache } from "react";

import { hasSupabaseEnv } from "@/lib/env";
import { havenSnapshot } from "@/lib/repositories/mock-data";
import { supabaseHavenRepository } from "@/lib/repositories/supabase-case-compass";
import type { HavenWorkspaceSnapshot } from "@/types/domain";

export const getSnapshot = cache(async (): Promise<HavenWorkspaceSnapshot> => {
  if (hasSupabaseEnv) {
    try {
      return await supabaseHavenRepository.getSnapshot();
    } catch {
      return havenSnapshot;
    }
  }

  return havenSnapshot;
});
