/**
 * The 60-day arithmetic.
 *
 * This is the only place in the product that turns a stored date into a deadline
 * somebody will act on, and it is asserted heavily for one reason: a wrong answer
 * here is invisible. An off-by-one produces a date that looks entirely reasonable,
 * reads fine in the answer, and sends someone to file on the wrong day.
 *
 * The cases that earn their place are the ones a hand-written date calculation
 * gets wrong: month boundaries, leap days, year rollovers, and timezones. The
 * timezone one is not hypothetical — parsing a stored date-only string in local
 * time moves a layoff on the 1st to the 31st for anybody west of Greenwich, and
 * takes the deadline with it.
 *
 * Also asserted: what this must refuse to compute. A future layoff date is a
 * typo, not a grace period, and reporting "day -3,000" would look like a bug in
 * the answer because it would be one.
 *
 * Run: npm run check:grace-period
 */

export {};

async function main() {
  const { readGracePeriod, renderGracePeriodForPrompt, GRACE_PERIOD_DAYS } = await import("@/lib/advisor/grace-period");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const on = (iso: string) => new Date(`${iso}T12:00:00Z`);

  check("the ceiling is 60 days", GRACE_PERIOD_DAYS === 60, `${GRACE_PERIOD_DAYS}`);

  // ---------------------------------------------------------------- basic count
  const day5 = readGracePeriod("2026-08-14", on("2026-08-19"));
  check("day 5 is day 5", day5?.dayNumber === 5, `${day5?.dayNumber}`);
  check("day 5 ends on Oct 13", day5?.graceEndDate === "2026-10-13", `${day5?.graceEndDate}`);
  check("day 5 has 55 days left", day5?.daysRemaining === 55, `${day5?.daysRemaining}`);
  check("day 5 has not expired", day5?.expired === false, `${day5?.expired}`);

  // The day of the layoff itself is day 0 — the clock starts the day after.
  const sameDay = readGracePeriod("2026-08-19", on("2026-08-19"));
  check("the last day of work is day 0, not day 1", sameDay?.dayNumber === 0, `${sameDay?.dayNumber}`);

  // ------------------------------------------------------------- the boundaries
  const exactly60 = readGracePeriod("2026-06-20", on("2026-08-19"));
  check("day 60 has not expired yet", exactly60?.dayNumber === 60 && exactly60?.expired === false, `day ${exactly60?.dayNumber} expired=${exactly60?.expired}`);

  const day61 = readGracePeriod("2026-06-19", on("2026-08-19"));
  check("day 61 has expired", day61?.dayNumber === 61 && day61?.expired === true, `day ${day61?.dayNumber} expired=${day61?.expired}`);

  // ----------------------------------------------------- calendar edge cases
  const acrossYear = readGracePeriod("2025-12-15", on("2026-01-10"));
  check("counting across a year boundary", acrossYear?.dayNumber === 26 && acrossYear?.graceEndDate === "2026-02-13", `day ${acrossYear?.dayNumber} end ${acrossYear?.graceEndDate}`);

  const leap = readGracePeriod("2028-01-15", on("2028-02-01"));
  check("a leap year February is counted correctly", leap?.graceEndDate === "2028-03-15", `${leap?.graceEndDate}`);

  const monthEnd = readGracePeriod("2026-01-31", on("2026-02-05"));
  check("a month-end layoff does not roll over", monthEnd?.graceEndDate === "2026-04-01", `${monthEnd?.graceEndDate}`);

  // A stored date-only string parsed in local time shifts west of Greenwich.
  // Asserted at a moment where a naive parse would land on the previous day.
  const midnightEdge = readGracePeriod("2026-03-01", new Date("2026-03-01T03:00:00Z"));
  check("a date-only value is not shifted by the timezone", midnightEdge?.layoffDate === "2026-03-01", `${midnightEdge?.layoffDate}`);

  // -------------------------------------------------------------- what it refuses
  check("no date means no reading", readGracePeriod(null, on("2026-08-19")) === null, "it returned something");
  check("an empty date means no reading", readGracePeriod("", on("2026-08-19")) === null, "it returned something");
  check("garbage means no reading", readGracePeriod("last Tuesday", on("2026-08-19")) === null, "it returned something");
  check(
    "a future layoff date is treated as a typo, not a grace period",
    readGracePeriod("2027-01-01", on("2026-08-19")) === null,
    "it produced a reading"
  );

  // ------------------------------------------------------------- what it renders
  const rendered = renderGracePeriodForPrompt(day5).join("\n");
  check("the rendering names the source date", /August 14, 2026/.test(rendered), rendered);
  check("the rendering gives the computed end date", /October 13, 2026/.test(rendered), rendered);
  check("the rendering says which day today is", /day 5/.test(rendered), rendered);
  check(
    "the rendering never presents the date as a guaranteed deadline",
    /ceiling|may shorten|ends earlier/i.test(rendered),
    rendered
  );
  check(
    "the rendering asks the model to name the date it used",
    /name the last-day date you used|invite a correction/i.test(rendered),
    rendered
  );

  const expiredRender = renderGracePeriodForPrompt(readGracePeriod("2026-05-22", on("2026-08-19"))).join("\n");
  check("an expired period says so", /passed 29 days ago/.test(expiredRender), expiredRender);
  check(
    "an expired period does not conclude the person is out of status",
    /do not conclude from this alone/i.test(expiredRender),
    expiredRender
  );

  check("nothing renders from nothing", renderGracePeriodForPrompt(null).length === 0, "it rendered something");

  // ------------------------------------------------------- one calculator only
  //
  // The reason this check exists: the dashboard used to count the 60 days from
  // the moment somebody pressed the activation button rather than from their last
  // day of work. Nobody presses it the hour they are let go, so the number was
  // wrong for everyone and wrong in the dangerous direction — "Day 1 of 60, 59
  // days remaining" shown to a person who had thirty. It was invisible until the
  // Advisor began counting too and the two contradicted each other on one screen.
  //
  // The rule asserted: anything that turns the *stored* layoff date into a day
  // count goes through this module. A hand-rolled version elsewhere is exactly the
  // kind of change that looks harmless in review and puts two numbers on one
  // screen again.
  //
  // Not covered, and deliberately: /tools has its own 60-day estimator. It takes
  // dates the visitor types rather than reading anything stored, is not signed in,
  // and additionally compares against I-94 expiry, which this module does not
  // model. Folding them together is a real piece of work rather than a rename, so
  // it is named here instead of quietly excluded.
  const fs = await import("node:fs");
  const path = await import("node:path");

  const crisisState = fs.readFileSync(path.resolve(process.cwd(), "src/lib/get-crisis-state.ts"), "utf8");
  check(
    "the crisis countdown comes from this module",
    /readGracePeriod\(/.test(crisisState),
    "get-crisis-state.ts does not call readGracePeriod"
  );
  check(
    "the crisis countdown does no day arithmetic of its own",
    !/86[_ ]?400[_ ]?000|864e5/.test(crisisState),
    "get-crisis-state.ts still divides milliseconds into days"
  );
  check(
    "the crisis countdown no longer counts from the activation time",
    !/getElapsedCrisisDays|Date\.now\(\) - activatedAt/.test(crisisState),
    "it is still counting from when the button was pressed"
  );

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    console.log("\nFailed:");
    for (const name of failures) console.log(`  - ${name}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
