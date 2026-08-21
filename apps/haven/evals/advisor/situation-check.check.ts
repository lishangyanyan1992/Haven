/**
 * What Haven assumes about somebody before it advises them.
 *
 * The rule this enforces: never recommend on a fact nobody confirmed. Haven holds
 * a profile, so unlike a general chatbot it never *has* to ask — and that is the
 * trap. It inherits whatever was true the last time the person edited their
 * profile and advises with full confidence on top of it.
 *
 * The tension to hold: asking is safe and asking is also a cost. A gate that
 * demands five facts is a form, and people abandon forms on the day they most
 * need not to. So these check both directions — that missing facts are asked for,
 * and that the asking stays small.
 *
 * Run: npm run check:situation-check
 */

export {};

async function main() {
  const { checkSituation, renderSituationForPrompt } = await import("@/lib/advisor/situation-check");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const EMPTY = {};
  const FULL = {
    visaType: "H1B",
    layoffDate: "2026-08-03",
    priorityDate: "2022-02-02",
    preferenceCategory: "EB2",
    countryOfBirth: "China"
  };

  // ------------------------------------------------ the facts a topic turns on
  const bulletin = checkSituation(["visa-bulletin"], EMPTY);
  const bulletinLabels = bulletin.missing.map((f) => f.label);
  check(
    "a bulletin question needs date, category and country",
    ["your priority date", "your green card category", "your country of birth"].every((l) => bulletinLabels.includes(l)),
    bulletinLabels.join(", ")
  );

  const layoff = checkSituation(["layoffs"], EMPTY);
  check(
    "a layoff question needs the last day of employment",
    layoff.missing.some((f) => f.label === "your last day of employment"),
    layoff.missing.map((f) => f.label).join(", ")
  );

  // Everything present means nothing to ask — but it does not mean nothing to say.
  const complete = checkSituation(["visa-bulletin", "layoffs"], FULL);
  check("nothing is asked for when everything is on file", complete.missing.length === 0, JSON.stringify(complete.missing));
  check("what the answer rests on is still listed", complete.known.length >= 4, JSON.stringify(complete.known));

  // ------------------------------------------------------------- placeholders
  //
  // A field holding "unknown" is worse than an empty one: it reads as an answer
  // and gets built on. This is the case that would silently defeat the whole gate.
  const placeholder = checkSituation(["visa-bulletin"], { ...FULL, preferenceCategory: "unknown" });
  check(
    'a category of "unknown" counts as missing, not as an answer',
    placeholder.missing.some((f) => f.label === "your green card category"),
    JSON.stringify(placeholder)
  );
  for (const value of ["", "  ", "n/a", "not_sure", "Other"]) {
    const result = checkSituation(["visa-bulletin"], { ...FULL, countryOfBirth: value });
    check(
      `"${value}" is not treated as a stated country of birth`,
      result.missing.some((f) => f.label === "your country of birth"),
      JSON.stringify(result.known)
    );
  }

  // ------------------------------------------------------- what reaches the model
  const missingLines = renderSituationForPrompt(checkSituation(["visa-bulletin"], EMPTY), true).join("\n");
  check(
    "a missing fact stops recommendations, not explanation",
    /do not tell them what to do/i.test(missingLines) && /explain how the rules work/i.test(missingLines),
    missingLines
  );
  check(
    "the question comes after the useful part, not before it",
    /Ask at the end, after the explanation/i.test(missingLines),
    missingLines
  );

  // A gate that asks for five things is a form. Two is enough to be honest and
  // few enough that a frightened person skimming will actually answer.
  const askedFor = (missingLines.match(/\?/g) ?? []).length;
  check(`at most two questions are asked at once (found ${askedFor})`, askedFor <= 3, missingLines);

  const knownLines = renderSituationForPrompt(checkSituation(["layoffs"], FULL), false).join("\n");
  check(
    "held facts are stated back so a wrong one gets corrected",
    /invite them to correct it/i.test(knownLines),
    knownLines
  );
  check(
    "the block is behaviour, not text to reproduce",
    /in your own words/i.test(knownLines),
    knownLines
  );

  // A topic with nothing to confirm produces nothing. Silence has to be an option
  // or the gate becomes a tax on every question.
  check(
    "a topic with no required facts produces no block",
    renderSituationForPrompt(checkSituation(["haven-product"], EMPTY), true).length === 0,
    "it produced one"
  );

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
