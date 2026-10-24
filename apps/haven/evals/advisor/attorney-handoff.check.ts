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

  // ------------------------------------------------- a firm's own client
  //
  // Since Haven became invitation-only, most people asking were invited by a law
  // firm. Sending them to the directory hands that firm's client to its
  // competitors (specs/advisor-attorney-handoff). And until the firm signs them,
  // it is not their lawyer, so the wording must not say it is.
  const STAGES = [
    "new_lead",
    "contacted",
    "consultation_scheduled",
    "consultation_completed",
    "contract_sent",
    "contract_signed",
    "archived"
  ] as const;
  const firmLink = (stage: (typeof STAGES)[number], name = "Rivera Immigration Law") => ({
    kind: "firm" as const,
    firmId: "firm-1",
    firmName: name,
    firmClientId: "fc-1",
    pipelineStatus: stage
  });
  const buildFor = (firm: Parameters<typeof buildAttorneyHandoff>[0]["firm"], context = {}) =>
    buildAttorneyHandoff({
      topics: ["layoffs"] as never,
      answer: "You should speak to an immigration attorney this week.",
      context,
      alreadyDelivered: false,
      firm,
      today
    });

  for (const stage of STAGES) {
    const built = buildFor(firmLink(stage), { layoffDate: "2026-08-03" });
    const text = built?.text ?? "";
    check(`firm client (${stage}): names the firm`, text.includes("Rivera Immigration Law"), text || "(nothing)");
    check(`firm client (${stage}): no directory link`, !text.includes("/lawyers"), text);
    check(`firm client (${stage}): no suggestion to look for another firm`, !/boutique|look for a|browse|other firms|shop around/i.test(text), text);
    check(`firm client (${stage}): no not-a-referral note`, !/not a referral/i.test(text), text);
    const signed = stage === "contract_signed";
    check(
      signed ? `firm client (${stage}): "your lawyer at" the firm` : `firm client (${stage}): never "your lawyer" or "your attorney"`,
      signed ? /your lawyer at Rivera Immigration Law/.test(text) : !/your (lawyer|attorney)/i.test(text) && /the firm that invited you, Rivera Immigration Law/.test(text),
      text
    );
    check(`firm client (${stage}): still says what to bring and ask`, /Take with you:/.test(text) && /Worth asking:/.test(text) && /August 3, 2026/.test(text), text);
    check(`firm client (${stage}): offers to let the firm know`, built?.contactOffer?.firmName === "Rivera Immigration Law", JSON.stringify(built?.contactOffer));
  }

  // The offer carries the dated lines and the questions shown, nothing else.
  const offerBuilt = buildFor(firmLink("new_lead"), { layoffDate: "2026-08-03", priorityDate: "2022-03-15" });
  const offer = offerBuilt?.contactOffer;
  check(
    "contact offer: only the dated take-with-you lines",
    offer?.dates.length === 2 && offer.dates.every((line) => (offerBuilt?.text ?? "").includes(line)) && !offer.dates.some((line) => /I-797/.test(line)),
    JSON.stringify(offer?.dates)
  );
  check(
    "contact offer: exactly the questions shown",
    (offer?.questions.length ?? 0) >= 3 && (offer?.questions ?? []).every((q) => (offerBuilt?.text ?? "").includes(`- ${q}`)),
    JSON.stringify(offer?.questions)
  );
  check("contact offer: practice area matches the block", offer?.practiceArea === offerBuilt?.practiceArea, JSON.stringify(offer));
  check(
    "contact offer: has no field beyond firm, area, dates and questions",
    JSON.stringify(Object.keys(offer ?? {}).sort()) === JSON.stringify(["dates", "firmName", "practiceArea", "questions"]),
    JSON.stringify(Object.keys(offer ?? {}))
  );

  // A firm's name is its own text. It must not become a link in the block.
  const hostile = buildFor(firmLink("new_lead", "Evil Law [click](https://example.com)"));
  check("a firm name cannot inject a link", !/\]\(https?:/.test(hostile?.text ?? ""), hostile?.text ?? "(nothing)");

  // Someone the owner invited directly: today's directory handoff, no offer.
  const noFirm = buildFor({ kind: "none" });
  const legacy = build(["layoffs"], "You should speak to an immigration attorney this week.");
  check("no firm: the same directory handoff as before", noFirm !== null && noFirm.text === legacy?.text, noFirm?.text ?? "(nothing)");
  check("no firm: no contact offer", noFirm?.contactOffer === null, JSON.stringify(noFirm?.contactOffer));
  check("omitting the firm means no firm", legacy?.contactOffer === null && legacy?.text === noFirm?.text, legacy?.text ?? "(nothing)");

  // Lookup failed: no directory (they may be a firm client), no offer, but the
  // dates and questions are still worth having.
  const unknown = buildFor({ kind: "unknown" }, { layoffDate: "2026-08-03" });
  check("unknown firm: no directory link", !(unknown?.text ?? "").includes("/lawyers"), unknown?.text ?? "(nothing)");
  check("unknown firm: no other-firm suggestion", !/boutique|browse|not a referral/i.test(unknown?.text ?? ""), unknown?.text ?? "(nothing)");
  check("unknown firm: no contact offer", unknown?.contactOffer === null, JSON.stringify(unknown?.contactOffer));
  check("unknown firm: still dates and questions", /August 3, 2026/.test(unknown?.text ?? "") && /Worth asking:/.test(unknown?.text ?? ""), unknown?.text ?? "(nothing)");

  // Once per thread holds across every heading, old and new.
  for (const [label, built] of [
    ["firm (not signed)", buildFor(firmLink("contacted"))],
    ["firm (signed)", buildFor(firmLink("contract_signed"))],
    ["unknown", unknown],
    ["no firm", noFirm]
  ] as const) {
    check(`a delivered ${label} handoff is detectable in thread history`, HANDOFF_DELIVERED.test(built?.text ?? ""), built?.text ?? "(nothing)");
  }
  check(
    "a firm handoff is not repeated after an older directory handoff",
    buildAttorneyHandoff({
      topics: ["layoffs"] as never,
      answer: "Talk to an immigration attorney.",
      context: {},
      alreadyDelivered: HANDOFF_DELIVERED.test(recommended?.text ?? ""),
      firm: firmLink("new_lead"),
      today
    }) === null,
    "it repeated"
  );

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
