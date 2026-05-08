"use client";

import { createSupabaseBrowserClient as createSharedSupabaseBrowserClient } from "@haven/auth/browser";
import type { Database } from "@/types/database";

export function createSupabaseBrowserClient() {
  return createSharedSupabaseBrowserClient<Database>();
}
