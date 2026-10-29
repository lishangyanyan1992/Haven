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
  const { getDefaultRequiredDocuments, validateRequiredDocumentList } = await import("@/lib/document-vault");
  const { getDefaultIntakeQuestions, validateIntakeQuestionList } = await import("@/lib/firms/intake-questions");

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

  // 2a. Per-sponsor flag
  const sponsorTest = validateRequiredDocumentList([
    { key: "i140_notice", label: "I-140 approval notice" },
    { key: "passport_biographic_page", label: "Passport biographic page" },
    { key: "", label: "Employment verification letter", isCustom: true, perSponsor: true },
    { key: "", label: "Updated resume", isCustom: true }
  ]);
  check(
    "per sponsor: presets default by type, custom items opt in",
    sponsorTest.ok &&
      sponsorTest.items[0].perSponsor === true &&
      sponsorTest.items[1].perSponsor === false &&
      sponsorTest.items[2].perSponsor === true &&
      sponsorTest.items[3].perSponsor === false,
    JSON.stringify(sponsorTest)
  );
  const roundTrip = sponsorTest.ok ? validateRequiredDocumentList(sponsorTest.items) : null;
  check(
    "per sponsor: saved custom per-sponsor item round-trips",
    Boolean(roundTrip?.ok && roundTrip.items[2].perSponsor === true && roundTrip.items[2].key === (sponsorTest.ok ? sponsorTest.items[2].key : "")),
    JSON.stringify(roundTrip)
  );
  const { unionRequiredDocuments } = await import("@/lib/firms/required-documents");
  const unioned = unionRequiredDocuments([
    { firmId: "firm-a-0000", docs: [{ key: "custom_letter", label: "Letter", isCustom: true, perSponsor: false }] },
    { firmId: "firm-b-0000", docs: [{ key: "custom_letter", label: "Letter", isCustom: true, perSponsor: true }] }
  ]);
  check(
    "per sponsor: two firms asking for the same item ask per sponsor if either does",
    unioned.length === 1 && unioned[0].perSponsor === true,
    JSON.stringify(unioned)
  );

  // 2b. Default required documents and default intake questions
  const defaultDocs = getDefaultRequiredDocuments();
  check("defaults: default required documents has 4 preset items", defaultDocs.length === 4, JSON.stringify(defaultDocs));
  const defaultQuestions = getDefaultIntakeQuestions();
  check("defaults: default intake questions has 16 preset items", defaultQuestions.length === 16, JSON.stringify(defaultQuestions));

  // 2c. Intake question validation
  const validQuestions = validateIntakeQuestionList([
    { key: "visaType", label: "Current visa status" },
    { key: "", label: "Have you ever been denied a visa?", isCustom: true }
  ]);
  check(
    "questions: accepts mixed preset and custom intake questions",
    validQuestions.ok && validQuestions.items.length === 2 && validQuestions.items[1].key.startsWith("custom_q_"),
    JSON.stringify(validQuestions)
  );
  const preserveQuestionKey = validateIntakeQuestionList([
    { key: "custom_q_prior_denial_2", label: "Prior denial details", isCustom: true }
  ]);
  check(
    "questions: preserves existing custom_q_ key",
    preserveQuestionKey.ok && preserveQuestionKey.items[0].key === "custom_q_prior_denial_2",
    JSON.stringify(preserveQuestionKey)
  );
  const duplicatePresetQuestion = validateIntakeQuestionList([
    { key: "visaType", label: "Current visa status" },
    { key: "visaType", label: "Current visa status" }
  ]);
  check(
    "questions: rejects duplicate preset keys",
    !duplicatePresetQuestion.ok,
    JSON.stringify(duplicatePresetQuestion)
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

  const questionsSourcePath = resolve(process.cwd(), "src/lib/firms/intake-questions.ts");
  const questionsSourceCode = readFileSync(questionsSourcePath, "utf-8");
  const questionLibFns = topLevelFunctions(questionsSourceCode);
  const saveQuestionsFn = questionLibFns.get("saveFirmIntakeQuestions");
  check("isolation: saveFirmIntakeQuestions function exists", Boolean(saveQuestionsFn), "function not found");
  check(
    "isolation: saveFirmIntakeQuestions body contains update scoped to firmId",
    Boolean(saveQuestionsFn && saveQuestionsFn.body.includes(".update(") && saveQuestionsFn.body.includes('.eq("id", firmId)')),
    saveQuestionsFn?.body ?? ""
  );

  // 4. Isolated function inspection: ensure saveFirmRequiredDocumentsAction and saveFirmIntakeQuestionsAction call requireFirmMember
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
  const saveQuestionsActionFn = actionFns.get("saveFirmIntakeQuestionsAction");
  check("auth: saveFirmIntakeQuestionsAction exists", Boolean(saveQuestionsActionFn), "action not found");
  check(
    "auth: saveFirmIntakeQuestionsAction body calls requireFirmMember",
    Boolean(saveQuestionsActionFn && saveQuestionsActionFn.body.includes("await requireFirmMember()")),
    saveQuestionsActionFn?.body ?? ""
  );

  console.log(`\n${pass}/${pass + failures.length} checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
