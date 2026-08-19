/**
 * The test people, checked for internal contradictions.
 *
 * A persona is a fixture that describes a human situation, and the failure mode
 * is not a crash — it is a persona whose dates disagree with each other. Somebody
 * "on day 5" whose grace period ends in three weeks produces answers that look
 * wrong, and the hours then go into the model instead of the fixture. Worse, the
 * finding is unfalsifiable from the outside: nothing in the answer says the
 * premise was broken.
 *
 * So the arithmetic is asserted here rather than trusted to have been done right
 * once. Every date is fixed rather than relative, which makes them checkable but
 * also means they go stale silently — the reference date below is the tripwire.
 *
 * Run: npm run check:personas
 */

export {};

/** The date the personas were written against. See TEST_PERSONAS. */
const REFERENCE_DATE = new Date("2026-08-19T00:00:00Z");

const GRACE_PERIOD_DAYS = 60;

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/** Pulls "Aug 14, 2026" out of a timeline entry's dateLabel. */
function dateFromLabel(label: string): Date | null {
  const parsed = new Date(`${label} UTC`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function main() {
  const { TEST_PERSONAS, resolveTestPersona, testPersonaIds } = await import("@/lib/repositories/test-personas");
  const { havenSnapshot } = await import("@/lib/repositories/mock-data");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  check("three personas exist", TEST_PERSONAS.length === 3, `got ${TEST_PERSONAS.length}`);

  for (const entry of TEST_PERSONAS) {
    const { id, snapshot } = entry;
    const profile = snapshot.profile;

    // The whole reason these exist: Priya is employed and every layoff answer
    // was written for her.
    check(
      `${id} is actually laid off`,
      profile.employmentStatus === "laid_off",
      `employmentStatus is "${profile.employmentStatus}"`
    );

    check(`${id} has a name of its own`, profile.fullName !== havenSnapshot.profile.fullName, `still ${profile.fullName}`);

    const lastDay = snapshot.timelineEvents.find((e) => /last day of employment/i.test(e.title));
    const graceEnd = snapshot.timelineEvents.find((e) => /grace period end/i.test(e.title));

    check(`${id} states a last day of employment`, Boolean(lastDay), "no last-day entry in the timeline");
    check(`${id} states when the grace period ends`, Boolean(graceEnd), "no grace-period entry in the timeline");

    if (!lastDay || !graceEnd) continue;

    const lastDayDate = dateFromLabel(lastDay.dateLabel);
    const graceEndDate = dateFromLabel(graceEnd.dateLabel);
    check(`${id} dates are readable`, Boolean(lastDayDate && graceEndDate), `${lastDay.dateLabel} / ${graceEnd.dateLabel}`);
    if (!lastDayDate || !graceEndDate) continue;

    const graceLength = daysBetween(lastDayDate, graceEndDate);
    check(
      `${id} grace period is ${GRACE_PERIOD_DAYS} days, not an approximation`,
      graceLength === GRACE_PERIOD_DAYS,
      `${lastDay.dateLabel} to ${graceEnd.dateLabel} is ${graceLength} days`
    );

    // The id is a claim about where in the 60 days this person is, and it is the
    // only part a reader will remember. It has to match the arithmetic.
    const claimedDay = Number(id.replace(/[^0-9]/g, ""));
    const actualDay = daysBetween(lastDayDate, REFERENCE_DATE);
    check(
      `${id} is genuinely on day ${claimedDay} as of the reference date`,
      claimedDay === actualDay,
      `laid off ${lastDay.dateLabel}, which is day ${actualDay} on ${REFERENCE_DATE.toISOString().slice(0, 10)}`
    );

    const expired = actualDay > GRACE_PERIOD_DAYS;
    check(
      `${id} tense matches whether the deadline has passed`,
      expired ? /ended/i.test(graceEnd.title) : /ends/i.test(graceEnd.title),
      `day ${actualDay} but the timeline says "${graceEnd.title}"`
    );

    // Only the first four timeline entries reach the model. A deadline sitting
    // fifth is a deadline the Advisor never sees.
    const graceIndex = snapshot.timelineEvents.indexOf(graceEnd);
    check(
      `${id} puts the deadline where the Advisor will read it`,
      graceIndex < 4,
      `grace-period entry is at position ${graceIndex + 1}; only the first 4 are passed to the model`
    );

    // The dashboard is what the person sees on screen next to the answer, so a
    // stale number there contradicts the Advisor in front of the user.
    if (profile.currentVisaExpiryDate) {
      const stated = snapshot.dashboard.signals.daysUntilVisaExpiry;
      const actual = daysBetween(REFERENCE_DATE, new Date(`${profile.currentVisaExpiryDate}T00:00:00Z`));
      check(
        `${id} days-until-expiry on the dashboard matches the profile date`,
        stated === actual,
        `dashboard says ${stated}, profile expiry ${profile.currentVisaExpiryDate} is ${actual} days out`
      );
    }

    // Same contradiction, different surface: the next-actions list is prose and
    // drifts out of tense when a date is edited.
    const tenseSlip = snapshot.dashboard.nextActions.find((action) =>
      expired ? /grace period ends\b/i.test(action) : /grace period ended\b/i.test(action)
    );
    check(
      `${id} next actions use the same tense as the deadline`,
      !tenseSlip,
      `day ${actualDay} but an action reads "${tenseSlip}"`
    );

    // An I-140 date with no approval, or a priority date with no I-140, is the
    // kind of quiet contradiction that produces a confidently wrong answer.
    if (!profile.i140Approved) {
      check(
        `${id} claims no I-140 benefits it does not have`,
        !profile.i140ApprovalDate && !profile.priorityDate,
        `i140Approved is false but approval date is ${profile.i140ApprovalDate} and priority date is ${profile.priorityDate}`
      );
    }
  }

  // Two personas that agree on everything test one thing twice.
  const countries = new Set(TEST_PERSONAS.map((p) => p.snapshot.profile.countryOfBirth));
  check("the personas differ by country", countries.size === TEST_PERSONAS.length, `${[...countries].join(", ")}`);

  const spouses = new Set(TEST_PERSONAS.map((p) => p.snapshot.profile.spouseVisaStatus));
  check("the personas differ by whether a spouse offers a bridge", spouses.size === TEST_PERSONAS.length, `${[...spouses].join(", ")}`);

  const withI140 = TEST_PERSONAS.filter((p) => p.snapshot.profile.i140Approved).length;
  check("at least one persona has no approved I-140", withI140 < TEST_PERSONAS.length, "every persona has one");

  // Selection has to be loud when it is wrong. A typo'd persona that silently
  // fell back to Priya would reintroduce the exact bug these fix.
  check("a typo'd persona name resolves to nothing rather than a default", resolveTestPersona("day-5x") === null, "it resolved to something");
  check("an unset persona resolves to nothing", resolveTestPersona(undefined) === null, "it resolved to something");
  check("a real persona name resolves", resolveTestPersona("day-42")?.id === "day-42", "it did not resolve");
  check("ids are listable for the runner", testPersonaIds().length === TEST_PERSONAS.length, "listing is out of sync");

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
