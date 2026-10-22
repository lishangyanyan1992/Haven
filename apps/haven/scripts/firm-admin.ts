/**
 * Owner tool for law firms (openspec change add-firm-dashboard).
 *
 *   npm run firm-admin -- list
 *   npm run firm-admin -- create-firm --name "Acme Immigration Law" [--lawyer jane@acme.com]
 *   npm run firm-admin -- add-lawyer --firm <firm-id> --email sam@acme.com
 *   npm run firm-admin -- remove-lawyer --email sam@acme.com
 *   npm run firm-admin -- show-link --firm <firm-id>
 *   npm run firm-admin -- delete-firm --firm <firm-id> --yes
 *   npm run firm-admin -- seed-demo --lawyer demo@haven-h1b.com [--name "Haven Demo Law"]
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
 * NEXT_PUBLIC_SITE_URL from apps/haven/.env.local.
 *
 * Adding a lawyer emails them a link to set their password. After that they
 * sign in and land on /firm. An email can be a lawyer at one firm, or a
 * client, never both.
 *
 * Intake links are stored as-is so lawyers can copy them again. If one leaks,
 * the lawyer (or you) replaces it from the dashboard, and the old one stops
 * working.
 *
 * delete-firm removes the firm, its lawyers' memberships, its link and its
 * client list. It does not delete anyone's account or documents.
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { provisionShowcaseUsersAndDocs, seedDemoFirm } from "../src/lib/firms/demo";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://haven-h1b.com").replace(/\/$/, "");

const [command, ...rest] = process.argv.slice(2);
function flag(name: string) {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
}
const has = (name: string) => rest.includes(`--${name}`);
const normalize = (e: string | undefined) => String(e ?? "").trim().toLowerCase();
function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function findUserId(email: string): Promise<string | null> {
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`Could not list users: ${error.message}`);
    const match = data.users.find((u) => normalize(u.email) === email);
    if (match) return match.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function linkFor(firmId: string) {
  const { data } = await db.from("firm_intake_links").select("token, is_active").eq("firm_id", firmId).is("revoked_at", null).maybeSingle();
  return data ? `${site}/i/${data.token}${data.is_active ? "" : "  (turned off)"}` : "(no link)";
}

async function addLawyer(firmId: string, rawEmail: string) {
  const email = normalize(rawEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`Not an email: ${rawEmail}`);

  const { data: firm } = await db.from("firms").select("id, name").eq("id", firmId).maybeSingle();
  if (!firm) fail(`No firm with id ${firmId}`);

  const { data: asLawyer } = await db.from("firm_members").select("firm_id, firms(name)").eq("email", email).maybeSingle();
  if (asLawyer) fail(`${email} already belongs to ${(asLawyer as any).firms?.name ?? asLawyer.firm_id}.`);

  const [asFirmClient, asInvite, asProfile, asWaitlist] = await Promise.all([
    db.from("firm_clients").select("id").eq("normalized_email", email).maybeSingle(),
    db.from("access_invites").select("normalized_email").eq("normalized_email", email).maybeSingle(),
    db.from("user_profiles").select("id").ilike("email", email.replace(/[\\%_]/g, "\\$&")).maybeSingle(),
    db.from("waitlist_signups").select("id").eq("normalized_email", email).maybeSingle()
  ]);

  if (asFirmClient.data || asInvite.data || asProfile.data || asWaitlist.data) {
    fail(`${email} is registered as a client or client waitlist entry, so it can't be a lawyer.`);
  }

  let userId: string | null = null;
  const invite = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${site}/auth/callback?next=/reset-password` });
  if (invite.error) {
    if (!/already|registered|exists/i.test(invite.error.message)) fail(`Could not invite ${email}: ${invite.error.message}`);
    userId = await findUserId(email);
    console.log(`${email} already has an account. They can sign in with their existing password.`);
  } else {
    userId = invite.data.user?.id ?? null;
    console.log(`Invite email sent to ${email}.`);
  }
  if (!userId) fail(`Could not find the account for ${email}.`);

  const { error } = await db.from("firm_members").insert({ firm_id: firmId, user_id: userId, email });
  if (error) fail(`Could not add ${email}: ${error.message}`);
  console.log(`${email} is now a lawyer at ${firm.name}.`);
}

async function main() {
  switch (command) {
    case "list": {
      const { data: firms } = await db.from("firms").select("id, name, created_at").order("created_at");
      if (!firms?.length) return console.log("No firms yet.");
      for (const firm of firms) {
        const { data: lawyers } = await db.from("firm_members").select("email").eq("firm_id", firm.id);
        const { count } = await db.from("firm_clients").select("id", { count: "exact", head: true }).eq("firm_id", firm.id);
        console.log(`\n${firm.name}\n  id:      ${firm.id}\n  lawyers: ${(lawyers ?? []).map((l) => l.email).join(", ") || "(none)"}\n  clients: ${count ?? 0}\n  link:    ${await linkFor(firm.id)}`);
      }
      return;
    }
    case "create-firm": {
      const name = String(flag("name") ?? "").trim();
      if (name.length < 2) fail('Give a name: --name "Acme Immigration Law"');
      const { data: firm, error } = await db.from("firms").insert({ name }).select("id, name").single();
      if (error) fail(`Could not create firm: ${error.message}`);
      const { error: linkError } = await db
        .from("firm_intake_links")
        .insert({ firm_id: firm.id, token: randomBytes(32).toString("base64url"), is_active: true });
      if (linkError) fail(`Firm created but no link: ${linkError.message}`);
      console.log(`Created ${firm.name}\n  id:   ${firm.id}\n  link: ${await linkFor(firm.id)}`);
      const lawyer = flag("lawyer");
      if (lawyer) await addLawyer(firm.id, lawyer);
      return;
    }
    case "add-lawyer": {
      const firmId = flag("firm");
      const email = flag("email");
      if (!firmId || !email) fail("Use: add-lawyer --firm <firm-id> --email <email>");
      await addLawyer(firmId, email);
      return;
    }
    case "remove-lawyer": {
      const email = normalize(flag("email"));
      if (!email) fail("Use: remove-lawyer --email <email>");
      const { data, error } = await db.from("firm_members").delete().eq("email", email).select("firm_id");
      if (error) fail(error.message);
      console.log(data?.length ? `${email} removed. They lose access on their next page load.` : `${email} isn't a lawyer at any firm.`);
      return;
    }
    case "show-link": {
      const firmId = flag("firm");
      if (!firmId) fail("Use: show-link --firm <firm-id>");
      console.log(await linkFor(firmId));
      return;
    }
    case "delete-firm": {
      const firmId = flag("firm");
      if (!firmId || !has("yes")) fail("Use: delete-firm --firm <firm-id> --yes");
      const { data: firm } = await db.from("firms").select("name").eq("id", firmId).maybeSingle();
      if (!firm) fail(`No firm with id ${firmId}`);
      const { error } = await db.from("firms").delete().eq("id", firmId);
      if (error) fail(error.message);
      console.log(`Deleted ${firm.name}. Accounts and documents were left alone.`);
      return;
    }
    case "seed-demo": {
      const lawyer = normalize(flag("lawyer"));
      if (!lawyer) fail("Use: seed-demo --lawyer <email> [--name <name>]");
      const name = String(flag("name") ?? "Haven Demo Law").trim();

      // Find or create demo firm
      let firmId: string | null = null;
      const { data: existingFirm } = await db
        .from("firms")
        .select("id, name, is_demo")
        .eq("is_demo", true)
        .order("created_at")
        .limit(1)
        .maybeSingle();

      if (existingFirm) {
        firmId = existingFirm.id;
        console.log(`Using existing demo firm: ${existingFirm.name} (${firmId})`);
      } else {
        const { data: created, error } = await db
          .from("firms")
          .insert({ name, is_demo: true })
          .select("id, name")
          .single();
        if (error) fail(`Could not create demo firm: ${error.message}`);
        firmId = created.id;
        await db
          .from("firm_intake_links")
          .insert({ firm_id: firmId, token: randomBytes(32).toString("base64url"), is_active: true });
        console.log(`Created new demo firm: ${name} (${firmId})`);
      }

      if (!firmId) fail("Could not establish demo firm id.");

      // Ensure lawyer is added
      await addLawyer(firmId, lawyer);

      // Provision showcase users & documents
      console.log("Provisioning showcase users and documents in haven-vault...");
      const showcaseUserMap = await provisionShowcaseUsersAndDocs();

      // Seed 50 demo leads
      console.log("Seeding 50 simulated leads...");
      const seeded = await seedDemoFirm(firmId, new Date(), showcaseUserMap);
      console.log(`Successfully seeded ${seeded.count} leads for ${name}.`);
      console.log(`Lawyer login: ${lawyer}`);
      console.log(`Dashboard URL: ${site}/firm`);
      return;
    }
    default:
      console.log("Commands: list, create-firm, add-lawyer, remove-lawyer, show-link, delete-firm, seed-demo. See the top of scripts/firm-admin.ts.");
  }
}

main().catch((error) => fail(String(error?.message ?? error)));
