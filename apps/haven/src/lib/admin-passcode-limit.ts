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

// Counts include the attempt being checked, so the limit-th try is still allowed.
export function isPasscodeLockedOut(counts: { visitor: number; overall: number }): boolean {
  return counts.visitor > ADMIN_PASSCODE_LIMITS.perVisitor || counts.overall > ADMIN_PASSCODE_LIMITS.overall;
}

export function hashAdminVisitor(ip: string): string {
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY || "haven";
  return createHash("sha256").update(`admin-passcode:${salt}:${ip}`).digest("hex");
}

// Every attempt is written down first and only then counted. Requests that
// arrive together each see the others' rows, so a burst can't slip past the
// limit. A passcode that turns out right, or a try that was refused, is erased
// again, so only wrong guesses keep counting.
export type AdminPasscodeAttempt = {
  allowed: boolean;
  /** Call when the passcode was right, so it doesn't count as a wrong guess. */
  forget: () => Promise<void>;
};

// Backup used only when the database can't be reached (or the table isn't
// there yet). It lives in one server instance's memory, so it is weaker.
type MemoryEntry = { visitor: string; at: number };
const memoryAttempts: MemoryEntry[] = [];

function reserveInMemory(visitor: string, now: number): AdminPasscodeAttempt {
  const oldest = now - ADMIN_PASSCODE_LIMITS.overallWindowMs;
  while (memoryAttempts.length > 0 && memoryAttempts[0].at < oldest) memoryAttempts.shift();
  const entry: MemoryEntry = { visitor, at: now };
  memoryAttempts.push(entry);
  const visitorSince = now - ADMIN_PASSCODE_LIMITS.perVisitorWindowMs;
  const counts = {
    visitor: memoryAttempts.filter((f) => f.visitor === visitor && f.at >= visitorSince).length,
    overall: memoryAttempts.length
  };
  const forget = async () => {
    const index = memoryAttempts.indexOf(entry);
    if (index >= 0) memoryAttempts.splice(index, 1);
  };
  const allowed = !isPasscodeLockedOut(counts);
  if (!allowed) void forget();
  return { allowed, forget };
}

export async function reserveAdminPasscodeAttempt(ip: string, now = Date.now()): Promise<AdminPasscodeAttempt> {
  const visitor = hashAdminVisitor(ip);
  try {
    const admin = createSupabaseAdminClient() as any;
    const { data: row, error: insertError } = await admin
      .from("admin_passcode_failures")
      .insert({ visitor_hash: visitor })
      .select("id")
      .single();
    if (insertError || !row) throw insertError ?? new Error("no row returned");

    const forget = async () => {
      const { error } = await admin.from("admin_passcode_failures").delete().eq("id", row.id);
      if (error) console.error("[admin-passcode] could not clear attempt", error);
    };

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
    if (mine.error || all.error) {
      // The attempt is recorded but can't be checked; refuse rather than guess.
      await forget();
      console.error("[admin-passcode] could not count attempts", mine.error ?? all.error);
      return { allowed: false, forget: async () => {} };
    }

    const allowed = !isPasscodeLockedOut({ visitor: mine.count ?? 0, overall: all.count ?? 0 });
    if (!allowed) await forget();
    return { allowed, forget };
  } catch (error) {
    console.error("[admin-passcode] database unavailable; using in-memory limit", error);
    return reserveInMemory(visitor, now);
  }
}
