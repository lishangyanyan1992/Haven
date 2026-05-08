import { createSupabaseAdminClient as createSharedSupabaseAdminClient } from "@haven/auth/admin";
import type { Database } from "@/types/database";

export function createSupabaseAdminClient() {
  return createSharedSupabaseAdminClient<Database>();
}
