/**
 * General-information-only mode (interim guard against unauthorized practice of law).
 *
 * Asserts the parts that code controls: the guard is on unless explicitly lifted,
 * it is appended last so the hosted prompt cannot drop it, and the Advisor is not
 * handed a computed personal deadline while it is on. Whether the model obeys the
 * wording is measured separately against live answers.
 *
 * Run: npm run check:general-info-mode
 */

export {};

async function main() {
  const { isGeneralInfoOnly, withGeneralInfoGuard, GENERAL_INFO_ONLY_INSTRUCTION } = await import(
    "@/lib/advisor/general-info-mode"
  );
  const svc = await import("@/lib/advisor/service");
  const { TEST_PERSONAS } = await import("@/lib/repositories/test-personas");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  check("on when the setting is missing", isGeneralInfoOnly({}) === true);
  check("on for any value other than lawyer-reviewed", isGeneralInfoOnly({ ADVISOR_CASE_SPECIFIC_ANSWERS: "on" }) === true);
  check("off only when lawyer review is live", isGeneralInfoOnly({ ADVISOR_CASE_SPECIFIC_ANSWERS: "lawyer-reviewed" }) === false);

  const hosted = "Hosted prompt text. Tell people their deadline.";
  const guarded = withGeneralInfoGuard(hosted, true);
  check("guard is appended after the hosted prompt", guarded.startsWith(hosted) && guarded.endsWith(GENERAL_INFO_ONLY_INSTRUCTION));
  check("guard is left out once lawyer review is live", withGeneralInfoGuard(hosted, false) === hosted);
  check("guard says it overrides earlier instructions", /overrides every earlier instruction/i.test(GENERAL_INFO_ONLY_INSTRUCTION));
  for (const banned of ["qualify", "deadline", "which form to file", "how to answer a question", "predict"]) {
    check(`guard names the forbidden move: ${banned}`, GENERAL_INFO_ONLY_INSTRUCTION.toLowerCase().includes(banned));
  }

  const persona = TEST_PERSONAS.find((p) => (p.snapshot as { activeLayoffEvent?: { layoffDate?: string } }).activeLayoffEvent?.layoffDate);
  check("a test persona with a layoff date exists", Boolean(persona));
  const snapshot = persona!.snapshot as never;
  const saved = process.env.ADVISOR_CASE_SPECIFIC_ANSWERS;
  delete process.env.ADVISOR_CASE_SPECIFIC_ANSWERS;
  check(
    "no computed grace deadline reaches the model while the guard is on",
    svc.buildAdvisorContext(snapshot).gracePeriodSummary.length === 0
  );
  const guardedContext = svc.buildAdvisorContext(snapshot);
  // Community stories are allowed and may mention layoffs; check everything else.
  const guardedText = JSON.stringify({ ...guardedContext, communitySummary: [] });
  check("no timeline, signals or email evidence reach the model", guardedContext.timelineSummary.length === 0 && guardedContext.derivedSignalsSummary.length === 0 && guardedContext.emailEvidenceSummary.length === 0);
  check("profile is reduced to the mode line and visa type", guardedContext.profileSummary.length === 2 && /General information mode/.test(guardedContext.profileSummary[0]));
  check("no priority date or layoff date in what the model sees", !/Priority date|Last day of employment|\b20\d\d-\d\d-\d\d\b/i.test(guardedText), guardedText.slice(0, 300));
  process.env.ADVISOR_CASE_SPECIFIC_ANSWERS = "lawyer-reviewed";
  check(
    "full profile comes back once lawyer review is live",
    svc.buildAdvisorContext(snapshot).profileSummary.length > 2
  );
  check(
    "the computed deadline comes back once lawyer review is live",
    svc.buildAdvisorContext(snapshot).gracePeriodSummary.length > 0
  );
  if (saved === undefined) delete process.env.ADVISOR_CASE_SPECIFIC_ANSWERS;
  else process.env.ADVISOR_CASE_SPECIFIC_ANSWERS = saved;

  // Memory, document passages and the bulletin position reach the prompt outside
  // the profile context, so they are gated separately.
  const personalInput = {
    rememberedFacts: [{ kind: "employment", quote: "My last day was 14 August", createdAt: "2026-08-20" }] as never,
    documentPassageLines: ["I-94 (page 1): Admit until 2027-03-01"],
    bulletinPosition: ["Their priority date 2021-11-03 is current for EB-2 India."]
  };
  const guardedBlocks = svc.buildPersonalPromptBlocks(personalInput, true);
  check(
    "no remembered facts, document passages or bulletin position while the guard is on",
    guardedBlocks.memoryAndDocuments.length === 0 && guardedBlocks.bulletinPosition.length === 0,
    JSON.stringify(guardedBlocks)
  );
  const liftedBlocks = svc.buildPersonalPromptBlocks(personalInput, false);
  const liftedText = [...liftedBlocks.memoryAndDocuments, ...liftedBlocks.bulletinPosition].join("\n");
  check(
    "all three come back once lawyer review is live",
    /told you before/.test(liftedText) && /Admit until/.test(liftedText) && /priority date 2021-11-03/.test(liftedText),
    liftedText.slice(0, 300)
  );

  // The lawyer hand-off passes the date along without working out the deadline.
  const { buildAttorneyHandoff } = await import("@/lib/advisor/attorney-handoff");
  delete process.env.ADVISOR_CASE_SPECIFIC_ANSWERS;
  const handoffSrc = (await import("node:fs")).readFileSync(new URL("../../src/lib/advisor/attorney-handoff.ts", import.meta.url), "utf8");
  check("hand-off has a guarded branch without the end date", /isGeneralInfoOnly\(\)\s*\?\s*`Your last day of employment — Haven has it as \$\{formatDate\(grace\.layoffDate\)\}\.`/.test(handoffSrc));
  void buildAttorneyHandoff;
  if (saved === undefined) delete process.env.ADVISOR_CASE_SPECIFIC_ANSWERS;
  else process.env.ADVISOR_CASE_SPECIFIC_ANSWERS = saved;

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
