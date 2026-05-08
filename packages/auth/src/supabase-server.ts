import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { applySharedCookieOptions } from "./cookie-options";
import { authEnv, hasSupabaseEnv } from "./env";

export async function createSupabaseServerClient<Database = any>() {
  const cookieStore = await cookies();

  if (!hasSupabaseEnv) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createServerClient<Database>(
    authEnv.NEXT_PUBLIC_SUPABASE_URL!,
    authEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, applySharedCookieOptions(options));
            });
          } catch {
            // Server components cannot always write cookies.
          }
        }
      }
    }
  );
}
