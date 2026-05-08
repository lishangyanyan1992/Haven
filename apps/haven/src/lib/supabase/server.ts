import { createSupabaseServerClient as createSharedSupabaseServerClient } from "@haven/auth/server";
import type { Database } from "@/types/database";

export async function createSupabaseServerClient() {
  return createSharedSupabaseServerClient<Database>();
}
