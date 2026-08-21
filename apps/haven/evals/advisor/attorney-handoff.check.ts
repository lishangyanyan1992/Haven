/**
 * Turning "talk to an immigration attorney" into somewhere to go.
 *
 * The thing most worth guarding here is not the wording — it is the link. A
 * `?focus=` value that no firm actually lists silently produces an empty
 * directory, which is a worse dead end than the one this feature exists to fix,
 * and nothing about it looks broken from the code. So the practice areas are
 * checked against the real firm data, not against a list written next to them.
 *
 * Run: npm run check:attorney-handoff
 */

export {};

async function main() {
  const { buildAttorneyHandoff, practiceAreaFor, HANDOFF_DELIVERED } = await import("@/lib/advisor/attorney-handoff");
  const { isArchivedPath } = await import("@/lib/archived-routes");
  const { allGuardrails } = await import("@/lib/advisor/guardrail-registry");
  const directory = (await import("@/data/law-firm-directory.json")).default as {
    firms: Array<{ practiceFocus: string[] }>;
  };

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const today = new Date("2026-08-20T12:00:00Z");
  const build = (topics: string[], answer: string, context = {}) =>
    buildAttorneyHandoff({
      topics: topics as never,
      answer,
      context,
      alreadyDelivered: false,
      today
    });

  // ------------------------------------------------------- the link must work
  //
  // Every area the router can produce has to exist in the firm data, or the
  // filtered directory comes back empty.
  const listedAreas = new Set(directory.firms.flatMap((firm) => firm.practiceFocus));
  const reachable = [
    ["self-petition", "EB-2 NIW"],
    ["perm", "PERM"],
    ["student-status", "Student"],
    ["h1b", "H-1B"],
    ["layoffs", "H-1B"],
    ["job-change", "H-1B"],
    ["visa-bulletin", "Immigration"]
  ] as const;

  for (const [topic, expected] of reachable) {
    const area = practiceAreaFor([topic] as never);
    check(`${topic} routes to ${expected}`, area === expected, `got ${area}`);
    check(`${expected} is a practice area firms actually list`, listedAreas.has(area), `not in: ${[...listedAreas].join(", ")}`);
  }

  // The narrowest topic chooses the firms. A PERM question that also mentions a
  // layoff should reach PERM firms, not the general list.
  // The two jobs are separate and must stay separate: the filter has to name a
  // real practice area or the directory comes back empty, while the questions only
  // have to be worth asking. Conflating them shipped a `?focus=Green card` link
  // that would have matched nothing — caught here, not in production.
  const greenCardHandoff = build(["visa-bulletin"], "You should speak to an immigration attorney about this.", {
    priorityDate: "2022-02-02"
  });
  check(
    "a green-card-queue question still filters to a real practice area",
    greenCardHandoff?.text.includes("/lawyers?focus=Immigration") ?? false,
    greenCardHandoff?.text ?? "(nothing)"
  );
  check(
    "and still gets priority-date questions rather than the generic set",
    /priority date and category/i.test(greenCardHandoff?.text ?? ""),
    greenCardHandoff?.text ?? "(nothing)"
  );

  check(
    "the most specific topic wins",
    practiceAreaFor(["layoffs", "perm"] as never) === "PERM",
    practiceAreaFor(["layoffs", "perm"] as never)
  );

  // ---------------------------------------------------------- when it appears
  const recommended = build(["h1b"], "You should speak with an immigration attorney about the filing.");
  check("an answer recommending counsel gets a handoff", recommended !== null, "it did not");
  // While /lawyers is parked the handoff must NOT link to it — a parked route
  // serves a 404, which is a worse dead end than the one this replaces. When it
  // comes back the link must carry the practice area, or the user lands on sixty
  // unfiltered firms and the handoff has told them nothing.
  const directoryLive = !isArchivedPath("/lawyers");
  check(
    directoryLive
      ? "the handoff links into the directory filtered to the area"
      : "the handoff does not link to the directory while it is parked",
    directoryLive
      ? (recommended?.text.includes("/lawyers?focus=H-1B") ?? false)
      : !(recommended?.text.includes("/lawyers") ?? true),
    recommended?.text ?? "(nothing)"
  );

  const noMention = build(["h1b"], "Your H-1B is valid until the date on your I-797. Nothing needs filing today.");
  check("an answer that never mentions counsel gets nothing", noMention === null, "it attached one anyway");

  const repeated = buildAttorneyHandoff({
    topics: ["h1b"] as never,
    answer: "Talk to an immigration attorney.",
    context: {},
    alreadyDelivered: true,
    today
  });
  check("the handoff fires once per thread, not every turn", repeated === null, "it repeated");

  check(
    "a delivered handoff is detectable in thread history",
    HANDOFF_DELIVERED.test(recommended?.text ?? ""),
    "the thread would deliver it again next turn"
  );

  // ------------------------------------------------------------ what to bring
  //
  // "Bring your dates" is useless to somebody who does not know which dates
  // matter. Where Haven holds a date, the handoff states it.
  const withDates = build(["layoffs"], "Talk to an immigration attorney this week.", {
    layoffDate: "2026-08-03",
    priorityDate: "2022-03-15"
  });
  check(
    "the user's own last day is stated, not asked for",
    /August 3, 2026/.test(withDates?.text ?? ""),
    withDates?.text ?? "(nothing)"
  );
  check(
    "the end of the 60-day period is stated so they can book before it",
    /October 2, 2026/.test(withDates?.text ?? ""),
    withDates?.text ?? "(nothing)"
  );
  check("a priority date on file is included", /March 15, 2022/.test(withDates?.text ?? ""), withDates?.text ?? "(nothing)");

  // And where it holds nothing, it asks for the document rather than inventing a
  // date — the rule that governs every other place the Advisor touches one.
  const noDates = build(["h1b"], "An immigration attorney should look at this.");
  check("no invented dates when Haven holds none", !/\b20\d\d\b/.test(noDates?.text ?? ""), noDates?.text ?? "(nothing)");
  check("it still says which documents to take", /I-94/.test(noDates?.text ?? ""), noDates?.text ?? "(nothing)");

  // --------------------------------------------------------------- the honesty
  //
  // The directory is public listings, not a referral, and Haven takes no fee. If
  // the Advisor is going to point at it, it says so in the same breath.
  check(
    directoryLive
      ? "the handoff says a listing is not a referral"
      : "no referral disclaimer when no directory is offered",
    directoryLive
      ? /not a referral/i.test(recommended?.text ?? "")
      : !/not a referral/i.test(recommended?.text ?? ""),
    recommended?.text ?? "(nothing)"
  );
  check(
    "the handoff never claims a firm is right for them",
    !/(recommend|best|top) (firm|lawyer|attorney)/i.test(recommended?.text ?? ""),
    recommended?.text ?? "(nothing)"
  );

  // Questions are the point of the block — a consultation is short and often paid.
  check(
    "it supplies questions to ask",
    (recommended?.text.match(/^- .+\?$/gm) ?? []).length >= 3,
    recommended?.text ?? "(nothing)"
  );

  // ------------------------------------------------- never link to a dead route
  //
  // The August 2026 simplification parked a third of the app behind a 404, and
  // two of the three links in the "I've misunderstood you twice" message pointed
  // straight at parked routes — delivered at the exact moment somebody is most
  // stuck. Nothing caught it, because a link is just a string. This is the check
  // that would have.
  const LINK = /\]\((\/[a-z0-9/-]*)/gi;
  const deadLinks: string[] = [];
  const scan = (label: string, text: string) => {
    for (const [, path] of text.matchAll(LINK)) {
      if (isArchivedPath(path)) deadLinks.push(`${label} -> ${path}`);
    }
  };

  for (const entry of allGuardrails()) {
    scan(entry.id, entry.text);
  }
  for (const [topic] of reachable) {
    const built = build([topic], "Speak to an immigration attorney.", { layoffDate: "2026-08-03" });
    if (built) scan(`handoff:${topic}`, built.text);
  }

  check("nothing the Advisor says links to a parked route", deadLinks.length === 0, deadLinks.join("\n      "));

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
