import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env, hasSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  if (!hasSupabaseEnv) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL!, env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components may not be allowed to write cookies. Auth writes should happen in actions/proxy.
        }
      }
    }
  });
}
