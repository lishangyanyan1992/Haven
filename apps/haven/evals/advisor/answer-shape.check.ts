/**
 * Splitting an answer into what everyone reads and what most people should not
 * have to.
 *
 * Sixteen brevity instructions in the system prompt moved nothing — measured over
 * four runs of one question: 557, 594, 761, 577 words. So the answer is no longer
 * asked to be short, it is asked to be ordered, and the app shows the lead with
 * the working behind a toggle.
 *
 * The rule that outranks everything else here: SAFETY TEXT IS NEVER COLLAPSED.
 * Hiding a guardrail addendum behind a button would be strictly worse than the
 * wall of text this replaces — a wall at least contains the warning. Most of what
 * follows is that rule.
 *
 * Second: every uncertain case must fall back to showing the whole answer. A bad
 * split hides half a sentence somebody is about to act on; not splitting just
 * looks like last week.
 *
 * Run: npm run check:answer-shape
 */

export {};

async function main() {
  const { splitAnswer, DETAIL_MARKER } = await import("@/lib/advisor/answer-shape");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const LONG_DETAIL = Array.from({ length: 12 }, (_, i) => `Condition ${i + 1} that affects the outcome in some way.`).join(" ");
  const LEAD = "Your grace period ends on September 6, 2026. File something before then or plan to depart.";

  // ------------------------------------------------------------ the marker path
  const marked = splitAnswer(`${LEAD}\n\n${DETAIL_MARKER}\n\n## The rules\n${LONG_DETAIL}`);
  check("the lead is what came before the marker", marked.lead === LEAD, marked.lead);
  check("the working goes behind the toggle", marked.details.includes("Condition 1"), marked.details.slice(0, 60));
  check("the marker never reaches the page", !`${marked.lead}${marked.details}`.includes(DETAIL_MARKER), "it survived");

  // A marker in a useless position tells us nothing, and must not produce a
  // two-word lead with everything hidden under it.
  const tooEarly = splitAnswer(`Short answer.\n${DETAIL_MARKER}\n${LONG_DETAIL}`);
  check("a marker emitted too early is ignored", tooEarly.details === "", tooEarly.details.slice(0, 60));
  check("and is still stripped from the text", !tooEarly.lead.includes(DETAIL_MARKER), tooEarly.lead);

  const tooLate = splitAnswer(`${LEAD} ${LONG_DETAIL}\n${DETAIL_MARKER}\nOne more line.`);
  check("a marker emitted at the very end is ignored", tooLate.details === "", tooLate.details.slice(0, 60));

  // --------------------------------------------------------- the fallback path
  //
  // The model reliably produces headings even while ignoring every instruction
  // about length, so a heading is the most trustworthy boundary when the marker
  // is missing.
  const byHeading = splitAnswer(`${LEAD}\n\n## What the rules say\n${LONG_DETAIL}`);
  check("a heading is used as the boundary when no marker arrives", byHeading.lead === LEAD, byHeading.lead);
  check("and the heading itself stays with the detail", byHeading.details.startsWith("## What the rules say"), byHeading.details.slice(0, 40));

  const byBold = splitAnswer(`${LEAD}\n\n**What the rules say**\n${LONG_DETAIL}`);
  check("a bold line acting as a heading also works", byBold.lead === LEAD, byBold.lead);

  // ------------------------------------------------- when NOT to split at all
  const short = splitAnswer("Your grace period ends on September 6, 2026. File before then.");
  check("a short answer is left whole", short.details === "", short.details);

  const noBoundary = splitAnswer(`${LEAD} ${LONG_DETAIL}`);
  check("one long paragraph with no boundary is left whole", noBoundary.details === "", noBoundary.details.slice(0, 60));

  const tinyLead = splitAnswer(`Yes.\n\n## Why\n${LONG_DETAIL}`);
  check("a boundary that would leave a two-word lead is refused", tinyLead.details === "", tinyLead.details.slice(0, 40));

  // ------------------------------------------- SAFETY TEXT IS NEVER COLLAPSED
  const appendedCases: Array<[string, string]> = [
    ["the attorney handoff", "\n\n**Finding one, and getting your money's worth**\n\n[Browse H-1B firms](/lawyers?focus=H-1B)"],
    ["an H-1B safety note", "\n\nH-1B safety note: Confirm the exact grace-period deadline with immigration counsel."],
    ["a work-authorisation note", "\n\nWork authorization note: A change of status such as B-2 does not authorize you to work."]
  ];
  for (const [name, tail] of appendedCases) {
    const result = splitAnswer(`${LEAD}\n\n## The rules\n${LONG_DETAIL}${tail}`);
    check(`${name} is never hidden behind the toggle`, !result.details.includes(tail.trim()), "it was collapsed");
    check(`${name} is kept and shown`, result.appended.includes(tail.trim().slice(0, 25)), result.appended.slice(0, 60));
  }

  // And it must survive when there is nothing to split — the appended text still
  // has to be findable rather than silently dropped.
  const shortWithNote = splitAnswer(`${LEAD}\n\nH-1B safety note: Speak to counsel.`);
  check(
    "appended safety text survives an answer too short to split",
    shortWithNote.appended.includes("H-1B safety note") || shortWithNote.lead.includes("H-1B safety note"),
    JSON.stringify(shortWithNote)
  );

  // Nothing may ever be lost. Whatever the branch, every word is on the page.
  const full = `${LEAD}\n\n## The rules\n${LONG_DETAIL}\n\nH-1B safety note: Speak to counsel.`;
  const parts = splitAnswer(full);
  const reassembled = `${parts.lead} ${parts.details} ${parts.appended}`;
  for (const fragment of [LEAD, "Condition 1", "Condition 12", "H-1B safety note"]) {
    check(`"${fragment.slice(0, 30)}" survives the split`, reassembled.includes(fragment), reassembled.slice(0, 80));
  }

  // ------------------------------------------------- one list, not two
  //
  // The first version of the splitter guessed these labels with a regex and
  // silently failed on two of the six. They now live in one exported list that
  // service.ts builds the notes from, and this asserts the list still matches what
  // the service actually emits — because "a fact written down twice" is how it
  // broke the first time.
  const { APPENDED_BLOCK_LABELS } = await import("@/lib/advisor/answer-shape");
  const serviceSource = (await import("node:fs")).readFileSync(
    new URL("../../src/lib/advisor/service.ts", import.meta.url),
    "utf8"
  );
  check(
    "the service builds its notes from the shared list, not its own strings",
    !/notes\.push\(\["[A-Za-z0-9 -]+note:"/.test(serviceSource),
    "a hardcoded note label is back in service.ts"
  );
  for (const label of APPENDED_BLOCK_LABELS) {
    const result = splitAnswer(`${LEAD}\n\n## The rules\n${LONG_DETAIL}\n\n${label} Something important.`);
    check(`"${label}" is recognised as appended safety text`, result.appended.startsWith(label), result.appended.slice(0, 50));
  }

  console.log(`\n${pass} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
