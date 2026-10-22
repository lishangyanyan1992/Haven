/**
 * One firm must never see another firm's clients (specs/firm-accounts).
 *
 * The database rules are one layer. This guards the other: the server code.
 * It reads the firm code and fails if:
 *
 * 1. A firm data function queries firm_clients or firm_intake_links without
 *    filtering by the firmId it was given.
 * 2. A firm data function reads client profiles or documents without first
 *    looking the client up in firm_clients filtered by that firm.
 * 3. Firm code touches chats or remembered facts. Lawyers see intake only.
 * 4. A firm page or action passes anything other than the firm from
 *    requireFirmMember() into a firm data function.
 *
 * If this fails, fix the code, not the check. A firm id taken from a URL or
 * a form is exactly how one firm ends up reading another's clients.
 *
 * Run: npm run check:firm-isolation
 */

export {};

async function main() {
  const fs = await import("node:fs");
  const path = await import("node:path");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const root = path.resolve(new URL("../../", import.meta.url).pathname);
  const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8");

  /**
   * Split a file into its top-level functions, exported or not: name -> body.
   * Each body runs to the next top-level declaration, so one function's
   * queries are never counted as another's.
   */
  function topLevelFunctions(source: string) {
    const out = new Map<string, string>();
    const pattern = /^(?:export )?(?:async )?function (\w+)\s*\(([^)]*)\)/gm;
    const starts: { name: string; params: string; index: number }[] = [];
    for (const match of source.matchAll(pattern)) starts.push({ name: match[1], params: match[2], index: match.index ?? 0 });
    const boundaries = [...source.matchAll(/^(?:export )?(?:async )?(?:function|const|let|type|interface|class)\b/gm)].map((m) => m.index ?? 0);
    starts.forEach((start) => {
      const end = boundaries.find((b) => b > start.index) ?? source.length;
      out.set(start.name, `${start.params}\n${source.slice(start.index, end)}`);
    });
    return out;
  }

  /** Each `.from("table")` chain up to the end of its statement. */
  function queries(body: string, table: string) {
    const found: { text: string; index: number }[] = [];
    const needle = `.from("${table}")`;
    let at = body.indexOf(needle);
    while (at >= 0) {
      const end = body.indexOf(";", at);
      found.push({ text: body.slice(at, end < 0 ? undefined : end), index: at });
      at = body.indexOf(needle, at + needle.length);
    }
    return found;
  }

  // Functions that look up by something other than a firm, on purpose.
  const PUBLIC_BY_TOKEN = new Set(["lookupIntakeToken", "newIntakeToken", "intakeUrl"]);

  // ------------------------------------------------ 1 + 2: firm data functions
  for (const file of ["src/lib/firms/clients.ts", "src/lib/firms/links.ts"]) {
    const functions = topLevelFunctions(read(file));
    for (const [name, body] of functions) {
      if (PUBLIC_BY_TOKEN.has(name)) continue;
      const firmScoped = /\bfirmId\b/.test(body.split("\n")[0]);
      const firmQueries = [...queries(body, "firm_clients"), ...queries(body, "firm_intake_links")];
      if (firmQueries.length === 0) continue;

      check(`${file} ${name}() takes a firmId`, firmScoped, "Firm data functions must take the firm id as a parameter.");
      for (const query of firmQueries) {
        const isInsert = /\.insert\(\s*\{[^}]*firm_id:\s*firmId/.test(query.text);
        const filtered = /\.eq\("firm_id",\s*firmId\)/.test(query.text) || isInsert;
        check(
          `${file} ${name}() filters ${query.text.slice(7, query.text.indexOf('")'))} by firm`,
          filtered,
          `Query is missing .eq("firm_id", firmId):\n      ${query.text.replace(/\s+/g, " ").slice(0, 160)}`
        );
      }

      const clientDataReads = [...queries(body, "user_profiles"), ...queries(body, "user_documents")];
      if (clientDataReads.length > 0) {
        const firstScopedLookup = queries(body, "firm_clients").find((q) => /\.eq\("firm_id",\s*firmId\)/.test(q.text));
        const firstRead = Math.min(...clientDataReads.map((q) => q.index));
        check(
          `${file} ${name}() finds the client through its firm first`,
          Boolean(firstScopedLookup && firstScopedLookup.index < firstRead),
          "Read user_profiles / user_documents only for users found in firm_clients filtered by firm_id."
        );
      }
    }
  }

  // ------------------------------------------------ 3: intake only, no chats
  const firmSources = ["src/lib/firms/clients.ts", "src/lib/firms/links.ts", "src/lib/firms/access.ts", "src/server/firm-actions.ts"];
  const firmDir = path.join(root, "src/app/firm");
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? walk(path.join(dir, entry.name)) : /\.tsx?$/.test(entry.name) ? [path.join(dir, entry.name)] : []
    );
  const pageFiles = walk(firmDir).map((f) => path.relative(root, f));
  for (const file of [...firmSources, ...pageFiles]) {
    const source = read(file);
    const touchesChats = /advisor_(threads|messages|remembered_facts|feedback|message_citations)|rememberedFacts|searchUserDocuments/.test(source);
    check(`${file} stays out of chats`, !touchesChats, "The firm dashboard must not read chats or anything remembered from them.");
  }

  // ------------------------------------------------ 4: firm comes from requireFirmMember()
  const firmDataFunctions = [
    "listFirmClients",
    "getFirmClient",
    "markFirmClientReviewed",
    "firmDocumentUrl",
    "getCurrentFirmLink",
    "setFirmLinkActive",
    "replaceFirmLink"
  ];
  for (const file of ["src/server/firm-actions.ts", ...pageFiles]) {
    const source = read(file);
    const calls = [...source.matchAll(new RegExp(`\\b(${firmDataFunctions.join("|")})\\(([^,)]*)`, "g"))];
    if (calls.length === 0) continue;
    check(`${file} calls requireFirmMember()`, /requireFirmMember\(/.test(source), "Firm pages and actions must start with requireFirmMember().");
    for (const call of calls) {
      check(
        `${file} ${call[1]}() gets the lawyer's own firm`,
        call[2].trim() === "membership.firmId",
        `First argument must be membership.firmId from requireFirmMember(), got: ${call[2].trim() || "(nothing)"}`
      );
    }
  }

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
