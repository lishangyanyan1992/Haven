/**
 * Pull one Haven profile out of production into a local file, once.
 *
 * WHY A COPY RATHER THAN A LIVE CONNECTION
 *
 * The obvious design is to point the lab at production and read the profile on
 * every question. Three things make that the wrong call:
 *
 *   1. Every question would reserve a thread row in `advisor_threads`, because
 *      the reservation happens before generation. Prompt testing would pollute
 *      the same table the product reports usage from.
 *   2. The allowance is five conversations per 24 hours. A prompt-testing tool
 *      that stops working after five prompts is not a prompt-testing tool.
 *   3. The profile would move under the experiment. Two prompts compared an hour
 *      apart would not be compared against the same facts.
 *
 * A file fixes all three. Re-run this script whenever the profile has genuinely
 * changed and you want the lab to see it.
 *
 * PRIVACY
 *
 * Writes one real person's immigration profile to disk in plain text. The output
 * path is gitignored, and the script refuses to write anywhere else. Delete the
 * file when you are done testing.
 *
 * Usage:
 *   npx tsx --tsconfig tools/advisor-lab/tsconfig.json tools/advisor-lab/pull-profile.ts <email>
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export {};

const OUTPUT = path.join(process.cwd(), "tools/advisor-lab/profile.local.json");

// The lab reads env from apps/haven/.env.local, the same file `next dev` uses.
// Parsed by hand rather than pulled in as a dependency: this script runs outside
// the Next app, and one regex is cheaper than wiring dotenv into a second
// tsconfig.
function loadEnv() {
  const file = path.join(process.cwd(), "apps/haven/.env.local");
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    console.error(`Could not read ${file}. Run this from the repo root.`);
    process.exit(1);
  }

  for (const line of raw.split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const [, key, value] = match;
    if (!process.env[key]) process.env[key] = value.trim().replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: pull-profile.ts <email>");
    process.exit(1);
  }

  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in apps/haven/.env.local");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Resolve the email to a user id. listUsers is paged, so walk until found
  // rather than assuming the account is on page one.
  let userId: string | null = null;
  let fullName = "";
  for (let page = 1; page <= 20 && !userId; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error(`Could not list users: ${error.message}`);
      process.exit(1);
    }
    if (data.users.length === 0) break;

    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      userId = match.id;
      fullName = String(match.user_metadata?.full_name ?? "");
    }
  }

  if (!userId) {
    console.error(`No account found for ${email}.`);
    process.exit(1);
  }

  console.log(`Found ${email} → ${userId}${fullName ? ` (${fullName})` : ""}`);

  // Reuse the product's own snapshot builder rather than re-querying the tables.
  // A hand-rolled query here would drift from what the Advisor actually reads,
  // and the drift would be invisible: the lab would answer confidently from a
  // profile shaped slightly differently to the real one.
  process.env.HAVEN_LAB_USER_ID = userId;
  const { supabaseHavenRepository } = await import("@/lib/repositories/supabase-case-compass");

  let snapshot;
  try {
    snapshot = await supabaseHavenRepository.getSnapshot();
  } catch (error) {
    console.error(
      `Could not build the snapshot: ${(error as Error).message}\n` +
        "This usually means the repository resolves the user from an auth session rather than\n" +
        "from HAVEN_LAB_USER_ID. Check supabase-case-compass.ts and adjust this script to match."
    );
    process.exit(1);
  }

  writeFileSync(OUTPUT, JSON.stringify(snapshot, null, 2));

  const profile = snapshot.profile;
  console.log(`\nWrote ${OUTPUT}`);
  console.log("Profile summary:");
  // Enough to confirm the right account came back, without printing the whole
  // record to a terminal that may be shared or recorded.
  console.log(`  visaType: ${profile.visaType}`);
  console.log(`  preferenceCategory: ${profile.preferenceCategory}`);
  console.log(`  countryOfBirth: ${profile.countryOfBirth}`);
  console.log(`  priorityDate: ${profile.priorityDate}`);
  console.log(`  i485Filed: ${String(profile.i485Filed)}`);
  console.log("\nThis file contains real personal data and is gitignored. Delete it when you are done.");
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
