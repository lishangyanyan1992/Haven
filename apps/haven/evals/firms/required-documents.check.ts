/**
 * Firm required documents server queries and actions check.
 *
 * Run: npm run check:firm-required-docs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export {};

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

async function main() {
  const { validateRequiredDocumentList } = await import("@/lib/document-vault");

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

  // 2. Preserves existing custom key (Issue 2)
  const existingKeyTest = validateRequiredDocumentList([
    { key: "custom_resume_cv_2", label: "Resume CV", isCustom: true }
  ]);
  check(
    "validation: preserves already assigned custom key",
    existingKeyTest.ok && existingKeyTest.items[0].key === "custom_resume_cv_2",
    JSON.stringify(existingKeyTest)
  );

  // 3. Isolated function inspection: ensure saveFirmRequiredDocuments updates ONLY scoped to firmId
  const sourcePath = resolve(process.cwd(), "src/lib/firms/required-documents.ts");
  const sourceCode = readFileSync(sourcePath, "utf-8");
  const libFns = topLevelFunctions(sourceCode);
  const saveFn = libFns.get("saveFirmRequiredDocuments");
  check("isolation: saveFirmRequiredDocuments function exists", Boolean(saveFn), "function not found");
  check(
    "isolation: saveFirmRequiredDocuments body contains update scoped to firmId",
    Boolean(saveFn && saveFn.body.includes(".update(") && saveFn.body.includes('.eq("id", firmId)')),
    saveFn?.body ?? ""
  );

  // 4. Isolated function inspection: ensure saveFirmRequiredDocumentsAction calls requireFirmMember
  const actionSourcePath = resolve(process.cwd(), "src/server/firm-actions.ts");
  const actionSourceCode = readFileSync(actionSourcePath, "utf-8");
  const actionFns = topLevelFunctions(actionSourceCode);
  const saveActionFn = actionFns.get("saveFirmRequiredDocumentsAction");
  check("auth: saveFirmRequiredDocumentsAction exists", Boolean(saveActionFn), "action not found");
  check(
    "auth: saveFirmRequiredDocumentsAction body calls requireFirmMember",
    Boolean(saveActionFn && saveActionFn.body.includes("await requireFirmMember()")),
    saveActionFn?.body ?? ""
  );

  console.log(`\n${pass}/${pass + failures.length} checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
