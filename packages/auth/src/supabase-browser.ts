"use client";

import { createBrowserClient } from "@supabase/ssr";

import { authEnv } from "./env";

export function createSupabaseBrowserClient<Database = any>() {
  if (!authEnv.NEXT_PUBLIC_SUPABASE_URL || !authEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return createBrowserClient<Database>(
    authEnv.NEXT_PUBLIC_SUPABASE_URL,
    authEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
