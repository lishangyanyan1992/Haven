/**
 * Lead urgency ranking (specs/lead-urgency-ranking).
 *
 * Every cutoff at and one day past its boundary, past and missing dates, the
 * exact reason text, and dashboard order. Fixed "today" so it never drifts.
 *
 * If a cutoff here fails, check the spec before changing the number: lawyers
 * were told these thresholds.
 *
 * Run: npm run check:lead-urgency
 */

export {};

async function main() {
  const { rankUrgency, compareByUrgency, parseDay, UNKNOWN_REASON } = await import("@/lib/firms/urgency");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const TODAY = new Date("2026-10-22T15:30:00Z");
  const inDays = (n: number) => new Date(Date.UTC(2026, 9, 22 + n)).toISOString().slice(0, 10);
  const tier = (answers: Record<string, string>, expected: string, name: string) => {
    const got = rankUrgency(answers, TODAY);
    check(name, got.tier === expected, `expected ${expected}, got ${got.tier} (${got.reason})`);
    return got;
  };

  // ---------------------------------------------------------------- cutoffs
  tier({ agencyDeadlineType: "rfe", agencyDeadlineDate: inDays(14) }, "urgent", "agency deadline in 14 days is urgent");
  tier({ agencyDeadlineType: "rfe", agencyDeadlineDate: inDays(15) }, "soon", "agency deadline in 15 days is soon");
  tier({ travelPlanned: "yes", travelDate: inDays(14) }, "urgent", "travel in 14 days is urgent");
  tier({ travelPlanned: "yes", travelDate: inDays(15) }, "soon", "travel in 15 days is soon");
  tier({ jobEnded: "yes", lastWorkDay: inDays(-45) }, "urgent", "grace period ending in 15 days is urgent");
  tier({ jobEnded: "yes", lastWorkDay: inDays(-44) }, "soon", "grace period ending in 16 days is soon");
  tier({ statusEndDate: inDays(30) }, "urgent", "status ending in 30 days is urgent");
  tier({ statusEndDate: inDays(31) }, "soon", "status ending in 31 days is soon");
  tier({ statusEndDate: inDays(90) }, "soon", "a date in 90 days is soon");
  tier({ statusEndDate: inDays(91) }, "later", "a date in 91 days is later");
  tier({ travelPlanned: "yes", travelDate: inDays(200) }, "later", "travel in 200 days is later");
  tier({ agencyDeadlineType: "interview", agencyDeadlineDate: inDays(0) }, "urgent", "a deadline today is urgent");

  // ---------------------------------------------------------------- past and missing
  const ended = tier({ statusEndDate: inDays(-5) }, "urgent", "status ended 5 days ago is urgent");
  check("past reason says days ago", ended.reason === "Status ended Oct 17 (5 days ago)", ended.reason);
  tier({ agencyDeadlineType: "rfe", agencyDeadlineDate: inDays(-2) }, "urgent", "a missed agency deadline is urgent");
  tier({ jobEnded: "yes", lastWorkDay: inDays(-70) }, "urgent", "a grace period that ended is urgent");
  tier({ travelPlanned: "yes", travelDate: inDays(-3) }, "unknown", "past travel is ignored");
  const none = tier({}, "unknown", "no answers is unknown");
  check("unknown reason asks about deadlines", none.reason === UNKNOWN_REASON && none.daysLeft === null, none.reason);
  tier({ statusEndUnknown: "yes" }, "unknown", "'not sure' is unknown");
  tier({ jobEnded: "no", lastWorkDay: inDays(-50) }, "unknown", "a last day is ignored when the job hasn't ended");
  tier({ travelPlanned: "no", travelDate: inDays(3) }, "unknown", "a travel date is ignored when no travel is planned");
  tier({ agencyDeadlineDate: inDays(3) }, "unknown", "an agency date without a type is ignored");
  tier({ statusEndDate: "2026-02-31" }, "unknown", "an impossible date is ignored");
  check("parseDay rejects junk", parseDay("next week") === null && parseDay("2026-13-01") === null && parseDay(undefined) === null, "should be null");

  // ---------------------------------------------------------------- reasons
  const laidOff = rankUrgency({ jobEnded: "yes", lastWorkDay: "2026-09-10" }, TODAY);
  check("laid-off reason matches the spec", laidOff.reason === "Laid off Sep 10, grace period ends Nov 9 (18 days)", laidOff.reason);
  const jobEnding = rankUrgency({ jobEnded: "yes", lastWorkDay: inDays(10) }, TODAY);
  check("future last day says job ends", jobEnding.reason.startsWith("Job ends Nov 1, grace period ends"), jobEnding.reason);
  const rfe = rankUrgency({ agencyDeadlineType: "rfe", agencyDeadlineDate: inDays(12) }, TODAY);
  check("RFE reason", rfe.reason === "RFE response due Nov 3 (12 days)", rfe.reason);
  const interview = rankUrgency({ agencyDeadlineType: "interview", agencyDeadlineDate: inDays(1) }, TODAY);
  check("interview reason, singular day", interview.reason === "Interview on Oct 23 (1 day)", interview.reason);
  const today = rankUrgency({ agencyDeadlineType: "biometrics", agencyDeadlineDate: inDays(0) }, TODAY);
  check("a date today says today", today.reason === "Biometrics appointment on Oct 22 (today)", today.reason);
  const nextYear = rankUrgency({ statusEndDate: "2027-03-01" }, TODAY);
  check("a date next year shows the year", nextYear.reason === "Status ends Mar 1, 2027 (130 days)", nextYear.reason);
  const several = rankUrgency({ statusEndDate: inDays(80), travelPlanned: "yes", travelDate: inDays(10) }, TODAY);
  check("several dates: the soonest is named", several.tier === "urgent" && several.reason.startsWith("Travel on Nov 1"), several.reason);
  const urgentNotSoonest = rankUrgency({ statusEndDate: inDays(25), travelPlanned: "yes", travelDate: inDays(20) }, TODAY);
  check(
    "urgent clients name the date that makes them urgent",
    urgentNotSoonest.tier === "urgent" && urgentNotSoonest.reason.startsWith("Status ends"),
    urgentNotSoonest.reason
  );

  // ---------------------------------------------------------------- order
  const row = (name: string, answers: Record<string, string>, createdAt: string, emailSent = false) => ({
    name,
    emailSent,
    createdAt,
    urgency: rankUrgency(answers, TODAY)
  });
  const rows = [
    row("unknown", {}, "2026-10-21T00:00:00Z"),
    row("soon", { statusEndDate: inDays(60) }, "2026-10-01T00:00:00Z"),
    row("urgent-12", { agencyDeadlineType: "rfe", agencyDeadlineDate: inDays(12) }, "2026-10-02T00:00:00Z"),
    row("pending", { agencyDeadlineType: "rfe", agencyDeadlineDate: inDays(1) }, "2026-10-22T00:00:00Z", true),
    row("urgent-3", { travelPlanned: "yes", travelDate: inDays(3) }, "2026-10-03T00:00:00Z"),
    row("unknown-newer", {}, "2026-10-22T00:00:00Z")
  ];
  const order = [...rows].sort(compareByUrgency).map((r) => r.name).join(",");
  check(
    "dashboard order: tier, days left, newest, email-sent last",
    order === "urgent-3,urgent-12,soon,unknown-newer,unknown,pending",
    order
  );

  // ---------------------------------------------------------------- cleaning answers (setup step 5 / prompt)
  const { deadlineDraftFromForm, mergeDeadlineAnswers } = await import("@/lib/deadlines");
  const form = (entries: Record<string, string>) => ({
    has: (k: string) => k in entries,
    get: (k: string) => (k in entries ? entries[k] : null)
  });
  const clean = deadlineDraftFromForm(
    form({ statusEndDate: "2027-01-15", jobEnded: "no", lastWorkDay: "2026-10-01", agencyDeadlineType: "rfe", agencyDeadlineDate: "2026-11-03", travelPlanned: "yes", travelDate: "not a date" }),
    TODAY
  );
  check("cleaning: keeps a real status date", clean.statusEndDate === "2027-01-15", JSON.stringify(clean));
  check("cleaning: drops a last day when the job hasn't ended", clean.lastWorkDay === "", JSON.stringify(clean));
  check("cleaning: keeps an agency date with its type", clean.agencyDeadlineType === "rfe" && clean.agencyDeadlineDate === "2026-11-03", JSON.stringify(clean));
  check("cleaning: blanks an invalid travel date", clean.travelPlanned === "yes" && clean.travelDate === "", JSON.stringify(clean));
  const unsure = deadlineDraftFromForm(form({ statusEndUnknown: "yes", statusEndDate: "2027-01-15" }), TODAY);
  check("cleaning: 'not sure' clears the status date", unsure.statusEndUnknown === "yes" && unsure.statusEndDate === "", JSON.stringify(unsure));
  const farOff = deadlineDraftFromForm(form({ statusEndDate: "2099-01-01" }), TODAY);
  check("cleaning: a date decades away is rejected", farOff.statusEndDate === "", JSON.stringify(farOff));
  const untouched = deadlineDraftFromForm(form({ travelPlanned: "no" }), TODAY);
  check("cleaning: fields not sent are left out", !("statusEndDate" in untouched) && untouched.travelDate === "", JSON.stringify(untouched));
  const merged = mergeDeadlineAnswers({ travelPlanned: "yes", travelDate: "2026-11-01", statusEndDate: "2027-01-15" }, untouched);
  check(
    "cleaning: switching travel to no removes the date, keeps the rest",
    merged.travelPlanned === "no" && !("travelDate" in merged) && merged.statusEndDate === "2027-01-15",
    JSON.stringify(merged)
  );

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
