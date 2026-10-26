/**
 * One firm must never see another firm's clients (specs/firm-accounts).
 *
 * The database rules are one layer. This guards the other: the server code.
 * It reads the firm code and fails if:
 *
 * 1. A firm data function queries firm_clients or firm_intake_links, or calls
 *    a database function, without scoping it to the firmId it was given.
 * 2. A firm data function reads client documents without first finding the
 *    client in firm_clients scoped to that firm, either itself or through a
 *    helper that does.
 * 3. Firm dashboard code reads user_profiles (the chat writes there; lawyers
 *    see the firm's own copy of setup answers) or anything from chats.
 * 4. A firm page or action passes anything other than the firm from
 *    requireFirmMember() into a firm data function.
 * 5. The urgency ranking (src/lib/firms/urgency.ts) reaches outside the
 *    firm's shared answers: it may import only from src/lib/firms and must
 *    not touch the database, the network or the environment.
 * 6. firm_contact_requests is readable by anyone but its own firm's lawyers,
 *    or writable from the browser at all. Its migration may grant exactly one
 *    policy: a lawyer select keyed on haven_firm_id(). Clients send requests
 *    through a server action that derives the firm itself.
 *
 * The rules also run against small deliberately broken examples, which must
 * fail, so the check can't quietly stop checking.
 *
 * If this fails, fix the code, not the check. A firm id taken from a URL or
 * a form is exactly how one firm ends up reading another's clients.
 *
 * Run: npm run check:firm-isolation
 */

export {};

type Source = { name: string; source: string };

/** Split a file into its top-level functions, exported or not: name -> params + body. */
function topLevelFunctions(source: string) {
  const out = new Map<string, { params: string; body: string }>();
  const starts = [...source.matchAll(/^(?:export )?(?:async )?function (\w+)\s*\(([^)]*)\)/gm)];
  const boundaries = [...source.matchAll(/^(?:export )?(?:async )?(?:function|const|let|type|interface|class)\b/gm)].map((m) => m.index ?? 0);
  for (const start of starts) {
    const index = start.index ?? 0;
    const end = boundaries.find((b) => b > index) ?? source.length;
    out.set(start[1], { params: start[2], body: source.slice(index, end) });
  }
  return out;
}

/** Each `.from("table")` or `.rpc(` chain up to the end of its statement. */
function statements(body: string, needle: string) {
  const found: { text: string; index: number }[] = [];
  let at = body.indexOf(needle);
  while (at >= 0) {
    const end = body.indexOf(";", at);
    found.push({ text: body.slice(at, end < 0 ? undefined : end), index: at });
    at = body.indexOf(needle, at + needle.length);
  }
  return found;
}

const SCOPED = /\.eq\("firm_id",\s*firmId\)/;
const PUBLIC_BY_TOKEN = new Set(["lookupIntakeToken", "newIntakeToken", "intakeUrl", "admin"]);
const FIRM_DATA_FUNCTIONS = [
  "listFirmClients",
  "getFirmClient",
  "markFirmClientReviewed",
  "saveFirmClientEngagement",
  "saveFirmConsultationBooking",
  "getFirmConsultationBooking",
  "firmDocumentUrl",
  "getCurrentFirmLink",
  "setFirmLinkActive",
  "replaceFirmLink",
  "resetDemoFirm",
  "markContactRequestHandled"
];

/** Rules 1-3 on firm data files. Returns failure messages. */
function checkDataFiles(files: Source[]) {
  const failures: string[] = [];
  for (const file of files) {
    const functions = topLevelFunctions(file.source);

    // Helpers that look the client up in firm_clients scoped to the firm.
    const scopedHelpers = new Set(
      [...functions].filter(([, fn]) => statements(fn.body, '.from("firm_clients")').some((q) => SCOPED.test(q.text))).map(([name]) => name)
    );

    for (const [name, fn] of functions) {
      if (PUBLIC_BY_TOKEN.has(name)) continue;
      const takesFirm = /\bfirmId\b/.test(fn.params);
      const firmQueries = [
        ...statements(fn.body, '.from("firm_clients")'),
        ...statements(fn.body, '.from("firm_intake_links")'),
        ...statements(fn.body, '.from("firm_contact_requests")')
      ];
      const rpcs = statements(fn.body, ".rpc(");
      if ((firmQueries.length || rpcs.length) && !takesFirm) failures.push(`${file.name} ${name}(): firm data functions must take firmId`);
      for (const q of firmQueries) {
        const insertScoped = /\.insert\(\s*\{[^}]*firm_id:\s*firmId/.test(q.text);
        if (!SCOPED.test(q.text) && !insertScoped) failures.push(`${file.name} ${name}(): query not scoped by firm: ${q.text.replace(/\s+/g, " ").slice(0, 120)}`);
      }
      for (const q of rpcs) {
        if (!/p_firm_id:\s*firmId\b/.test(q.text)) failures.push(`${file.name} ${name}(): database call not scoped by firm: ${q.text.replace(/\s+/g, " ").slice(0, 120)}`);
      }

      const docReads = statements(fn.body, '.from("user_documents")');
      if (docReads.length) {
        const firstRead = Math.min(...docReads.map((q) => q.index));
        const ownLookup = statements(fn.body, '.from("firm_clients")').find((q) => SCOPED.test(q.text));
        const helperCall = [...scopedHelpers]
          .filter((helper) => helper !== name)
          .map((helper) => fn.body.search(new RegExp(`\\b${helper}\\(\\s*firmId\\b`)))
          .filter((i) => i >= 0);
        const lookupAt = Math.min(ownLookup?.index ?? Infinity, ...(helperCall.length ? helperCall : [Infinity]));
        if (!(lookupAt < firstRead)) failures.push(`${file.name} ${name}(): reads documents without first finding the client in its firm`);
      }

      if (/\.from\("user_profiles"\)/.test(fn.body)) failures.push(`${file.name} ${name}(): reads user_profiles; use the firm's shared_answers copy`);
    }
  }
  return failures;
}

const CHAT = /advisor_(threads|messages|remembered_facts|feedback|message_citations)|rememberedFacts|searchUserDocuments|\.from\("user_profiles"\)/;

/** Rule 4 on firm pages and actions. */
function checkCallers(files: Source[]) {
  const failures: string[] = [];
  for (const file of files) {
    const calls = [...file.source.matchAll(new RegExp(`\\b(${FIRM_DATA_FUNCTIONS.join("|")})\\(([^,)]*)`, "g"))];
    if (!calls.length) continue;
    if (!/requireFirmMember\(/.test(file.source)) failures.push(`${file.name}: must start with requireFirmMember()`);
    for (const call of calls) {
      if (call[2].trim() !== "membership.firmId") failures.push(`${file.name} ${call[1]}(): got firm from ${call[2].trim() || "(nothing)"}, not membership.firmId`);
    }
  }
  return failures;
}

/** Rule 5: urgency.ts is a pure function of the shared answers. */
function checkPureRanking(file: Source) {
  const failures: string[] = [];
  for (const m of file.source.matchAll(/^import\s[^;]*?from\s+"([^"]+)"/gm)) {
    if (!m[1].startsWith("@/lib/firms/")) failures.push(`${file.name}: imports ${m[1]}`);
  }
  if (/\bfetch\(|process\.env|\.from\(\s*"|createClient|createSupabase/.test(file.source)) {
    failures.push(`${file.name}: touches the database, network or environment`);
  }
  return failures;
}

/**
 * Rule 7: a contact request never moves anyone. Code that touches
 * firm_contact_requests must not update firm_clients (the stage), and the
 * ranking must not see the request.
 */
function checkContactRequestsMoveNothing(file: Source) {
  const failures: string[] = [];
  for (const [name, fn] of topLevelFunctions(file.source)) {
    if (!fn.body.includes('.from("firm_contact_requests")')) continue;
    if (statements(fn.body, '.from("firm_clients")').some((q) => /\.update\(/.test(q.text))) {
      failures.push(`${file.name} ${name}(): handles contact requests and updates firm_clients`);
    }
  }
  for (const call of file.source.matchAll(/(rankUrgency|compareByUrgency)\(([\s\S]*?)\)\s*[;,)]/g)) {
    if (/contact/i.test(call[2])) failures.push(`${file.name}: ${call[1]} is given the contact request`);
  }
  return failures;
}

/** Rule 6: contact requests are lawyer-read-only at the database. */
function checkContactRequestPolicies(file: Source) {
  const failures: string[] = [];
  const sql = file.source.replace(/--[^\n]*/g, "");
  if (!/alter table public\.firm_contact_requests enable row level security/i.test(sql)) {
    failures.push(`${file.name}: row level security not enabled on firm_contact_requests`);
  }
  const policies = [...sql.matchAll(/create policy[^;]*?on public\.firm_contact_requests([^;]*);/gis)].map((m) => m[1]);
  if (policies.length !== 1) failures.push(`${file.name}: expected exactly one policy on firm_contact_requests, found ${policies.length}`);
  for (const policy of policies) {
    if (!/\bfor select\b/i.test(policy)) failures.push(`${file.name}: a policy other than select: ${policy.replace(/\s+/g, " ").trim()}`);
    if (!/using\s*\(\s*firm_id\s*=\s*public\.haven_firm_id\(\)\s*\)/i.test(policy)) {
      failures.push(`${file.name}: select policy not keyed on haven_firm_id(): ${policy.replace(/\s+/g, " ").trim()}`);
    }
  }
  if (/grant\s+[^;]*\bon\s+(table\s+)?public\.firm_contact_requests\b/i.test(sql)) failures.push(`${file.name}: grants on firm_contact_requests`);
  return failures;
}

async function main() {
  const fs = await import("node:fs");
  const path = await import("node:path");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, problems: string[], expectProblems = false) => {
    const ok = expectProblems ? problems.length > 0 : problems.length === 0;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${expectProblems ? "expected this broken example to be caught" : problems.join("\n      ")}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const root = path.resolve(new URL("../../", import.meta.url).pathname);
  const read = (relative: string): Source => ({ name: relative, source: fs.readFileSync(path.join(root, relative), "utf8") });
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(path.join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [path.join(dir, entry.name)] : []
    );
  const pages = walk(path.join(root, "src/app/firm")).map((f) => read(path.relative(root, f)));

  // ------------------------------------------------ the real code
  const dataFiles = ["src/lib/firms/clients.ts", "src/lib/firms/links.ts"].map(read);
  for (const file of dataFiles) check(`${file.name}: every firm query is scoped`, checkDataFiles([file]));
  for (const file of [...dataFiles, read("src/lib/firms/access.ts"), read("src/server/firm-actions.ts"), ...pages]) {
    check(`${file.name}: no chats, no live profiles`, CHAT.test(file.source) ? ["touches chats or user_profiles"] : []);
  }
  for (const file of [read("src/server/firm-actions.ts"), ...pages]) check(`${file.name}: firm comes from requireFirmMember()`, checkCallers([file]));

  check("src/lib/firms/urgency.ts: ranking is a pure function of shared answers", checkPureRanking(read("src/lib/firms/urgency.ts")));

  check("src/lib/firms/clients.ts: a contact request never changes stage or urgency", checkContactRequestsMoveNothing(read("src/lib/firms/clients.ts")));

  const contactMigration: Source = {
    name: "supabase/migrations/0044_firm_contact_requests.sql",
    source: fs.readFileSync(path.join(root, "../../supabase/migrations/0044_firm_contact_requests.sql"), "utf8")
  };
  check(`${contactMigration.name}: contact requests readable only by the firm's lawyers, never written from the browser`, checkContactRequestPolicies(contactMigration));

  // ------------------------------------------------ broken examples that must be caught
  const bad = (name: string, source: string) => ({ name: `example:${name}`, source });
  check(
    "catches a ranking that reads the database",
    checkPureRanking(bad("impure-ranking", `import { createSupabaseAdminClient } from "@/lib/supabase/admin";\nexport function rankUrgency() {}\n`)),
    true
  );
  check(
    "catches an unscoped client query",
    checkDataFiles([bad("unscoped", `export async function getFirmClient(firmId: string, id: string) {\n  await db.from("firm_clients").select("*").eq("id", id);\n}\n`)]),
    true
  );
  check(
    "catches a document read through an unscoped helper",
    checkDataFiles([
      bad(
        "unscoped-helper",
        `async function rows(firmId: string) {\n  return db.from("firm_clients").select("*");\n}\nexport async function listFirmClients(firmId: string) {\n  const r = await rows(firmId);\n  await db.from("user_documents").select("user_id").in("user_id", ids);\n}\n`
      )
    ]),
    true
  );
  check(
    "accepts a document read through a scoped helper",
    checkDataFiles([
      bad(
        "scoped-helper",
        `async function rows(firmId: string) {\n  return db.from("firm_clients").select("*").eq("firm_id", firmId);\n}\nexport async function listFirmClients(firmId: string) {\n  const r = await rows(firmId);\n  await db.from("user_documents").select("user_id").in("user_id", ids);\n}\n`
      )
    ])
  );
  check(
    "catches a document read with no firm lookup",
    checkDataFiles([bad("no-lookup", `export async function docs(firmId: string, userId: string) {\n  await db.from("user_documents").select("*").eq("user_id", userId);\n}\n`)]),
    true
  );
  check(
    "catches a live profile read",
    checkDataFiles([
      bad("profile", `export async function c(firmId: string) {\n  await db.from("firm_clients").select("*").eq("firm_id", firmId);\n  await db.from("user_profiles").select("*");\n}\n`)
    ]),
    true
  );
  check(
    "catches an unscoped database call",
    checkDataFiles([bad("rpc", `export async function replaceFirmLink(firmId: string) {\n  await db.rpc("firm_replace_intake_link", { p_firm_id: otherId });\n}\n`)]),
    true
  );
  check(
    "catches a firm id from the URL",
    checkCallers([bad("caller", `const membership = await requireFirmMember();\nawait getFirmClient(params.firmId, id);\n`)]),
    true
  );

  check(
    "catches handling a request that also moves the stage",
    checkContactRequestsMoveNothing(
      bad(
        "moves-stage",
        `export async function markContactRequestHandled(firmId: string, id: string) {\n  await db.from("firm_contact_requests").update({ handled_at: now }).eq("firm_id", firmId).eq("id", id);\n  await db.from("firm_clients").update({ pipeline_status: "contacted" }).eq("firm_id", firmId);\n}\n`
      )
    ),
    true
  );
  check(
    "catches a ranking that sees the request",
    checkContactRequestsMoveNothing(bad("ranks-request", `const u = rankUrgency(answers, now, row.openContactRequest);\n`)),
    true
  );
  check(
    "catches an unscoped contact request query",
    checkDataFiles([bad("unscoped-request", `export async function markContactRequestHandled(firmId: string, id: string) {\n  await db.from("firm_contact_requests").update({ handled_at: now }).eq("id", id);\n}\n`)]),
    true
  );

  const policyExample = (extra: string) =>
    bad(
      "contact-policy",
      `alter table public.firm_contact_requests enable row level security;\ncreate policy "lawyers read" on public.firm_contact_requests for select to authenticated using (firm_id = public.haven_firm_id());\n${extra}`
    );
  check(
    "catches a client insert policy on contact requests",
    checkContactRequestPolicies(
      policyExample(`create policy "clients write" on public.firm_contact_requests for insert to authenticated with check (true);\n`)
    ),
    true
  );
  check(
    "catches a contact request read not keyed on the firm",
    checkContactRequestPolicies(
      bad(
        "contact-open-read",
        `alter table public.firm_contact_requests enable row level security;\ncreate policy "anyone reads" on public.firm_contact_requests for select to authenticated using (true);\n`
      )
    ),
    true
  );
  check(
    "catches contact requests without row level security",
    checkContactRequestPolicies(
      bad("contact-no-rls", `create policy "lawyers read" on public.firm_contact_requests for select to authenticated using (firm_id = public.haven_firm_id());\n`)
    ),
    true
  );
  check("accepts the lawyer-read-only contact policy", checkContactRequestPolicies(policyExample("")));

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
