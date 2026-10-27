import { createHash } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Caps wrong admin passcode guesses. One visitor gets a few tries; across all
// visitors there is a ceiling too, so rotating addresses doesn't help. Real
// admins who are locked out can still sign in with an ADMIN_EMAILS account.
export const ADMIN_PASSCODE_LIMITS = {
  perVisitor: 5,
  perVisitorWindowMs: 15 * 60 * 1000,
  overall: 30,
  overallWindowMs: 60 * 60 * 1000
} as const;

export function isPasscodeLockedOut(counts: { visitor: number; overall: number }): boolean {
  return counts.visitor >= ADMIN_PASSCODE_LIMITS.perVisitor || counts.overall >= ADMIN_PASSCODE_LIMITS.overall;
}

export function hashAdminVisitor(ip: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY || "haven";
  return createHash("sha256").update(`admin-passcode:${salt}:${ip}`).digest("hex");
}

// Backup used only when the database can't be reached (or the table isn't
// there yet). It lives in one server instance's memory, so it is weaker.
const memoryFailures: Array<{ visitor: string; at: number }> = [];

function memoryCounts(visitor: string, now: number) {
  const oldest = now - ADMIN_PASSCODE_LIMITS.overallWindowMs;
  while (memoryFailures.length > 0 && memoryFailures[0].at < oldest) memoryFailures.shift();
  const visitorSince = now - ADMIN_PASSCODE_LIMITS.perVisitorWindowMs;
  return {
    visitor: memoryFailures.filter((f) => f.visitor === visitor && f.at >= visitorSince).length,
    overall: memoryFailures.length
  };
}

async function databaseCounts(visitor: string, now: number) {
  const admin = createSupabaseAdminClient() as any;
  const visitorSince = new Date(now - ADMIN_PASSCODE_LIMITS.perVisitorWindowMs).toISOString();
  const overallSince = new Date(now - ADMIN_PASSCODE_LIMITS.overallWindowMs).toISOString();
  const [mine, all] = await Promise.all([
    admin
      .from("admin_passcode_failures")
      .select("id", { count: "exact", head: true })
      .eq("visitor_hash", visitor)
      .gte("created_at", visitorSince),
    admin
      .from("admin_passcode_failures")
      .select("id", { count: "exact", head: true })
      .gte("created_at", overallSince)
  ]);
  if (mine.error || all.error) throw mine.error ?? all.error;
  return { visitor: mine.count ?? 0, overall: all.count ?? 0 };
}

export async function isAdminPasscodeLocked(ip: string, now = Date.now()): Promise<boolean> {
  const visitor = hashAdminVisitor(ip);
  const memory = memoryCounts(visitor, now);
  if (isPasscodeLockedOut(memory)) return true;
  try {
    return isPasscodeLockedOut(await databaseCounts(visitor, now));
  } catch (error) {
    console.error("[admin-passcode] could not read guess count; using in-memory count", error);
    return false;
  }
}

export async function recordAdminPasscodeFailure(ip: string, now = Date.now()): Promise<void> {
  const visitor = hashAdminVisitor(ip);
  memoryFailures.push({ visitor, at: now });
  try {
    const admin = createSupabaseAdminClient() as any;
    const { error } = await admin.from("admin_passcode_failures").insert({ visitor_hash: visitor });
    if (error) throw error;
  } catch (error) {
    console.error("[admin-passcode] could not record wrong guess in database", error);
  }
}
