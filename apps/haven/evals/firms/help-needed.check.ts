/**
 * "What help do you need from your lawyer?" (specs/client-help-request).
 *
 *   - the nine choices, in order, each with a description;
 *   - every choice maps to the old concern areas Haven's matching still reads;
 *   - a firm list saved under the old "Main concerns" key still turns the
 *     question on, in the same place;
 *   - an empty selection still clears the firm's copy, but only when the form
 *     showed the question.
 *
 * Run: npm run check:help-needed
 */

export {};

async function main() {
  const { HELP_NEEDED_OPTIONS, HELP_NEEDED_SENT_MARKER, concernsForHelpNeeded, helpNeededLabels, normalizeHelpNeeded } =
    await import("@/lib/firms/help-needed");
  const { normalizeIntakeQuestionKeys, validateIntakeQuestionList, DEFAULT_INTAKE_QUESTION_KEYS } = await import(
    "@/lib/firms/intake-question-catalog"
  );
  const { mergeSharedAnswers } = await import("@/lib/firms/answers");
  const fs = await import("node:fs");
  const path = await import("node:path");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // ---- the list
  const labels = HELP_NEEDED_OPTIONS.map((o) => o.label);
  const expected = [
    "First consultation",
    "Review my current case",
    "Plan if I lose my job",
    "Changing employers",
    "Other ways to stay in the US",
    "Next green card step",
    "Extend or renew my status",
    "Help for my spouse or children",
    "Something else"
  ];
  check("nine choices in the agreed order", JSON.stringify(labels) === JSON.stringify(expected), labels.join(" | "));
  check(
    "every choice has a one-line description",
    HELP_NEEDED_OPTIONS.every((o) => o.description.trim().length > 10 && !o.description.includes("\n"))
  );
  check(
    "other paths names the paths",
    /O-1/.test(HELP_NEEDED_OPTIONS.find((o) => o.value === "other_paths")!.description)
  );

  // ---- the database check lists the same values
  const migration = fs.readFileSync(
    path.resolve(new URL("../../../../supabase/migrations/0050_client_lawyer_messaging.sql", import.meta.url).pathname),
    "utf8"
  );
  check(
    "migration allows exactly these values",
    HELP_NEEDED_OPTIONS.every((o) => migration.includes(`'${o.value}'`)),
    "a value is missing from user_profiles_help_needed_values"
  );

  // ---- mapping to the old concern areas
  const mapping: [string, string[]][] = [
    ["first_consultation", []],
    ["case_review", ["gc_timeline"]],
    ["job_loss_plan", ["layoffs"]],
    ["changing_employers", ["job_change"]],
    ["other_paths", ["job_change"]],
    ["green_card_next_step", ["gc_timeline"]],
    ["extend_status", ["visa_expiry"]],
    ["family", []],
    ["something_else", []]
  ];
  for (const [choice, concerns] of mapping) {
    const got = concernsForHelpNeeded([choice]);
    check(`maps ${choice}`, JSON.stringify(got) === JSON.stringify(concerns), `got ${JSON.stringify(got)}`);
  }
  check(
    "combined choices de-duplicate",
    JSON.stringify(concernsForHelpNeeded(["changing_employers", "other_paths", "job_loss_plan"])) ===
      JSON.stringify(["job_change", "layoffs"])
  );
  check(
    "unknown values are dropped and order follows the list",
    JSON.stringify(normalizeHelpNeeded(["family", "nope", "first_consultation", "family"])) ===
      JSON.stringify(["first_consultation", "family"])
  );
  check(
    "lawyer sees labels",
    JSON.stringify(helpNeededLabels(["first_consultation"])) === JSON.stringify(["First consultation"])
  );

  // ---- old firm lists keep working
  check("catalog has helpNeeded, not topConcerns", DEFAULT_INTAKE_QUESTION_KEYS.includes("helpNeeded") && !DEFAULT_INTAKE_QUESTION_KEYS.includes("topConcerns"));
  const oldList = [
    { key: "visaType", label: "Current visa status", isCustom: false },
    { key: "topConcerns", label: "Main concerns", isCustom: false },
    { key: "travelPlanned", label: "Travel", isCustom: false }
  ];
  const normalized = normalizeIntakeQuestionKeys(oldList);
  check(
    "old key becomes helpNeeded in the same place",
    normalized.map((q) => q.key).join(",") === "visaType,helpNeeded,travelPlanned" && normalized[1].isCustom === false,
    JSON.stringify(normalized)
  );
  const validated = validateIntakeQuestionList(oldList);
  check(
    "saving an old list keeps it a preset, not a custom question",
    validated.ok && validated.items[1].key === "helpNeeded" && !validated.items[1].isCustom,
    JSON.stringify(validated)
  );
  const offList = normalizeIntakeQuestionKeys([{ key: "visaType", label: "Visa", isCustom: false }]);
  check("a firm that had it off still has it off", !offList.some((q) => q.key === "helpNeeded"));

  // ---- firm copy
  const form = (keys: string[]) => ({ has: (k: string) => keys.includes(k) });
  const before = { visaType: "H1B", helpNeeded: ["first_consultation"] };
  const cleared = mergeSharedAnswers(before, { helpNeeded: [] }, form([HELP_NEEDED_SENT_MARKER])).next;
  check("an empty selection clears the firm's copy when the question was shown", !("helpNeeded" in cleared), JSON.stringify(cleared));
  const untouched = mergeSharedAnswers(before, { visaType: "H1B" }, form(["visaType"])).next;
  check(
    "a form without the question leaves choices alone",
    JSON.stringify(untouched.helpNeeded) === JSON.stringify(["first_consultation"]),
    JSON.stringify(untouched)
  );
  const set = mergeSharedAnswers({}, { helpNeeded: ["family", "case_review"] }, form(["helpNeeded", HELP_NEEDED_SENT_MARKER])).next;
  check("choices reach the firm's copy", JSON.stringify(set.helpNeeded) === JSON.stringify(["family", "case_review"]), JSON.stringify(set));

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

void main();
