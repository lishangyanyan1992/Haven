import { createClient } from "@supabase/supabase-js";

import { authEnv } from "./env";

export function createSupabaseAdminClient<Database = any>() {
  if (!authEnv.NEXT_PUBLIC_SUPABASE_URL || !authEnv.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase admin environment variables are not configured.");
  }

  return createClient<Database>(
    authEnv.NEXT_PUBLIC_SUPABASE_URL,
    authEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
