/**
 * Firm required documents server queries and actions check.
 *
 * Run: npm run check:firm-required-docs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export {};

async function main() {
  const { validateRequiredDocumentList } = await import("@/lib/document-vault");
  const { getFirmRequiredDocuments, saveFirmRequiredDocuments } = await import("@/lib/firms/required-documents");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // 1. Validation behavior
  const invalid = validateRequiredDocumentList("not-an-array");
  check("validation: rejects non-array", !invalid.ok, JSON.stringify(invalid));

  const valid = validateRequiredDocumentList([
    { key: "passport_biographic_page", label: "Passport biographic page" },
    { key: "", label: "Client W-2", isCustom: true }
  ]);
  check("validation: accepts mixed presets and custom", valid.ok && valid.items.length === 2, JSON.stringify(valid));

  // 2. Static source inspection: ensure saveFirmRequiredDocuments updates ONLY scoped to firmId
  const sourcePath = resolve(process.cwd(), "src/lib/firms/required-documents.ts");
  const sourceCode = readFileSync(sourcePath, "utf-8");
  const hasFirmIdEq = sourceCode.includes('.eq("id", firmId)');
  check("isolation: update is strictly scoped with .eq('id', firmId)", hasFirmIdEq, sourceCode);

  // 3. Static source inspection: ensure server action calls requireFirmMember
  const actionSourcePath = resolve(process.cwd(), "src/server/firm-actions.ts");
  const actionSourceCode = readFileSync(actionSourcePath, "utf-8");
  const hasRequireFirmMember = actionSourceCode.includes("const membership = await requireFirmMember()");
  check("auth: server action requires firm membership", hasRequireFirmMember, actionSourceCode);

  console.log(`\n${pass}/${pass + failures.length} checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
