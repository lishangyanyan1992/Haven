import { createClient } from "@supabase/supabase-js";

import { authEnv } from "@haven/auth/env";
import type { Database } from "@/types/database";

// Cookie-less anon client for public data on static/ISR routes. The regular
// server client reads request cookies, which forces dynamic rendering.
export function createSupabasePublicClient() {
  if (!authEnv.NEXT_PUBLIC_SUPABASE_URL || !authEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createClient<Database>(authEnv.NEXT_PUBLIC_SUPABASE_URL, authEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      // Fail fast when Supabase is unreachable so static builds fall back to
      // the empty-state page instead of hanging past the prerender timeout.
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) })
    }
  });
}
