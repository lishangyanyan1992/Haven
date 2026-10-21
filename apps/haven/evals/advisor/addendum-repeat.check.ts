/**
 * The safety addendum must not make the answer say a required line twice.
 *
 * The addendum reads only the part of the answer shown before "more detail". A
 * required line the model put in the hidden part counts as missing and is added
 * to the visible block — correctly — but the hidden copy used to stay, so the
 * full answer said it twice. Seven of ten smoke answers failed on that on
 * 2026-10-20.
 *
 * What must hold, in order of importance:
 * - every required line still appears, in the visible block (the guarantee);
 * - the hidden copy goes, as a whole sentence or clause, never half of one;
 * - nothing the addendum did not add is touched.
 *
 * Run: npm run check:addendum-repeat
 */

export {};

async function main() {
  const { buildMandatorySafetyAddendum, removeCopiesOfAppendedLines, stripRedundantRepeats } = await import(
    "@/lib/advisor/service"
  );
  const { splitAnswer } = await import("@/lib/advisor/answer-shape");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;
  const NO_WORK = /do not work without authori[sz]/gi;
  const LCA = /lca[^.]{0,60}(does not|doesn't)[^.]{0,30}preserve status/gi;
  const COUNSEL = /confirm[^.]{0,80}(deadline|filing strategy)[^.]{0,60}counsel|immigration counsel immediately/gi;

  // The pipeline as the service runs it, minus the model.
  const finish = (question: string, body: string) => {
    let text = stripRedundantRepeats(body);
    const split = splitAnswer(text);
    const visible = split.details ? `${split.lead}\n\n${split.appended}` : text;
    const addendum = buildMandatorySafetyAddendum(question, ["layoffs"], visible);
    if (addendum.text) text = `${removeCopiesOfAppendedLines(text, addendum.fired)}\n\n${addendum.text}`;
    return { text, fired: addendum.fired };
  };

  const QUESTION = "I was laid off from my H-1B job, what should I do?";
  const LEAD =
    "You are likely in the H-1B grace period of up to 60 days or until your I-94 ends, whichever is shorter, and a new employer must properly file a nonfrivolous petition before it ends.";

  // Shaped like the 2026-10-20 failures: the required lines sit only below the fold.
  const HIDDEN = [
    LEAD,
    "",
    "<!--details-->",
    "",
    "What the rules mean for you now",
    "- Remain vs work: staying in the U.S. and being authorized to work are separate. Do not work without authorization. (8 CFR 214.1)",
    "- LCA preparation or documents sitting with the employer are not filings and do not preserve status. (8 CFR 214.2)",
    "- Immediate attorney review — DHS may shorten the 60-day period, and case specifics matter; confirm deadlines and filing strategy with counsel right away. (8 CFR 214.1)",
    "- Depart and consular return on a new H-1B petition (USCIS lists departure as an option)."
  ].join("\n");

  {
    const { text, fired } = finish(QUESTION, HIDDEN);
    check("addendum still fires for lines only in the hidden part", fired.includes("FIX_NO_UNAUTHORIZED_WORK"), fired.join(","));
    check("'do not work without authorization' appears once", count(text, NO_WORK) === 1, `x${count(text, NO_WORK)}`);
    check("'LCA does not preserve status' appears once", count(text, LCA) === 1, `x${count(text, LCA)}`);
    check("'confirm with counsel' appears once", count(text, COUNSEL) === 1, `x${count(text, COUNSEL)}`);
    const visible = (() => {
      const split = splitAnswer(text);
      return split.details ? `${split.lead}\n\n${split.appended}` : text;
    })();
    check("the surviving copy is in the visible block", count(visible, NO_WORK) === 1 && count(visible, LCA) === 1, visible);
    check(
      "the rest of a sentence-sharing line is kept",
      text.includes("- Remain vs work: staying in the U.S. and being authorized to work are separate.\n"),
      text
    );
    check(
      "a clause before a semicolon is kept",
      text.includes("- Immediate attorney review — DHS may shorten the 60-day period, and case specifics matter."),
      text
    );
    check("a bullet left empty is dropped", !/\n-\s*\n/.test(text) && !/\n-\s*$/.test(text), text);
    check("unrelated lines are untouched", text.includes("- Depart and consular return on a new H-1B petition (USCIS lists departure as an option)."), text);
  }

  // Already visible: nothing appended, nothing removed.
  {
    const body = `${LEAD} Do not work without authorization. LCA preparation alone does not preserve status. Confirm the exact deadline and filing strategy with immigration counsel immediately.`;
    const { text, fired } = finish(QUESTION, body);
    check("no addendum when the visible part already says it", !fired.includes("FIX_NO_UNAUTHORIZED_WORK"), fired.join(","));
    check("answer unchanged when nothing was appended", text.startsWith(body), text);
  }

  // The addendum and the repeat check used to read "doesn't" differently.
  {
    const body = `${LEAD} An LCA doesn't preserve status on its own. Do not work without authorisation. Confirm the deadline and filing strategy with counsel.`;
    const { text } = finish(QUESTION, body);
    check("'LCA doesn't preserve status' is recognised, not restated", count(text, LCA) === 1, `x${count(text, LCA)}`);
  }

  // A sentence that carries a second fact is never removed for its required line.
  {
    const body =
      "Intro.\n- Taking an unpaid role with the new employer does not keep your H-1B status alive, so do not work without authorization while you wait for the filing.";
    const out = removeCopiesOfAppendedLines(body, ["FIX_NO_UNAUTHORIZED_WORK"]);
    check("a sentence with another fact in it is kept whole", out === body, out);
  }

  // The three hidden copies that survived the first version of this fix, verbatim
  // from the 2026-10-20 run.
  {
    const counselOut = removeCopiesOfAppendedLines(
      "Intro.\n- Confirm the exact deadline (the last day you were in authorized stay) and the employer’s filing strategy with immigration counsel immediately.\n\nClosing question?",
      ["FIX_IMMEDIATE_COUNSEL"]
    );
    check("a counsel line with extra wording of its own is removed", count(counselOut, COUNSEL) === 0, counselOut);

    const lcaOut = removeCopiesOfAppendedLines(
      "Intro.\n- LCA or petition preparation alone does not preserve status — the new employer must properly file a nonfrivolous petition before your period ends.",
      ["FIX_LCA_NOT_PROTECTION"]
    );
    check("an LCA clause before a dash is removed", count(lcaOut, LCA) === 0, lcaOut);
    check(
      "the clause after the dash is kept",
      lcaOut.includes("- The new employer must properly file a nonfrivolous petition before your period ends."),
      lcaOut
    );

    const dashOut = removeCopiesOfAppendedLines(
      "Intro.\n- Immediate attorney review — DHS may shorten the period — confirm the deadline and filing strategy with counsel right away.",
      ["FIX_IMMEDIATE_COUNSEL"]
    );
    check("a counsel clause after a dash is removed, the rest kept", dashOut.includes("- Immediate attorney review — DHS may shorten the period.") && count(dashOut, COUNSEL) === 0, dashOut);
  }

  // Review findings on PR #96: never delete advice the safety note does not give back.
  {
    const payStubs = "Intro.\n- Do not work without authorization, and keep copies of your pay stubs.";
    const out = removeCopiesOfAppendedLines(payStubs, ["FIX_NO_UNAUTHORIZED_WORK"]);
    check("a short extra instruction keeps its sentence", out === payStubs, out);

    const bullets = [
      "- Do not work without authorization, and LCA preparation alone does not preserve status.",
      "- LCA preparation alone does not preserve status; keep copies of your pay stubs."
    ].join("\n");
    const repeatOut = stripRedundantRepeats(bullets);
    check("a repeated bullet keeps its new advice", repeatOut.includes("Keep copies of your pay stubs."), repeatOut);
    check("…and loses only the repeat", count(repeatOut, LCA) === 1, repeatOut);

    const checklist = [
      "Intro.",
      "",
      "Required safety steps",
      "- Keep your pay records.",
      "- Check the end date on your I-94."
    ].join("\n");
    const checklistOut = stripRedundantRepeats(checklist);
    check("a 'Required safety steps' checklist is kept", checklistOut.includes("Keep your pay records") && checklistOut.includes("I-94"), checklistOut);

    const recap = "Intro.\n\nSafety reminders\n- Do not work without authorization.";
    check("a 'Safety reminders' recap is still dropped", !stripRedundantRepeats(recap).includes("Safety reminders"), stripRedundantRepeats(recap));
  }

  // Paraphrases from the second 2026-10-20 run that say the line and nothing else.
  {
    const cos = removeCopiesOfAppendedLines(
      "Intro.\n- Change of status (for example B‑2): Filing to change to B‑2 before your authorised period ends is an available option; note explicitly that a change of status or a pending COS does not authorise employment. (USCIS guidance; 8 CFR 214.1)",
      ["FIX_COS_NO_WORK"]
    );
    check("a 'note explicitly that' change-of-status clause is removed", !/pending COS does not authorise/.test(cos) && cos.includes("is an available option."), cos);

    const lca = removeCopiesOfAppendedLines(
      "Intro.\n- LCA prep vs filing: Preparing an LCA or working on petition documents is not the same as filing; an LCA alone does not preserve status or permit work.",
      ["FIX_LCA_NOT_PROTECTION"]
    );
    check("an 'LCA … or permit work' clause is removed, the first clause kept", count(lca, LCA) === 0 && lca.includes("is not the same as filing."), lca);
  }

  // A bullet whose label is the required line keeps the explanation after the colon.
  {
    const out = removeCopiesOfAppendedLines(
      "Intro.\n  - Confirm the exact deadline with counsel: based on your last day of employment, the 60th day is the last practical day to have a petition properly filed.",
      ["FIX_IMMEDIATE_COUNSEL"]
    );
    check(
      "a counsel label before a colon is removed, the explanation kept",
      count(out, COUNSEL) === 0 && out.includes("  - Based on your last day of employment, the 60th day is the last practical day"),
      out
    );
    // The label's own colon is a clause break; a colon in a time is not.
    const time = "Intro.\n- Call at 10:30 and confirm the deadline and filing strategy with counsel.";
    check("a colon inside a time is not a clause break", removeCopiesOfAppendedLines(time, ["FIX_IMMEDIATE_COUNSEL"]) === time, removeCopiesOfAppendedLines(time, ["FIX_IMMEDIATE_COUNSEL"]));
  }

  // Only ids the addendum appended are removed.
  {
    const body = "Intro.\n- Do not work without authorization.\n- Confirm the deadline and filing strategy with counsel.";
    const out = removeCopiesOfAppendedLines(body, ["FIX_IMMEDIATE_COUNSEL"]);
    check("a line the addendum did not add is kept", out.includes("Do not work without authorization."), out);
    check("removing nothing returns the answer as is", removeCopiesOfAppendedLines(body, []) === body, "changed");
  }

  // A repeat bullet carrying two required lines, the second of which is new.
  {
    const body = [
      "- Do not work without authorization.",
      "- Do not work without authorization, and LCA preparation alone does not preserve status.",
      "- LCA preparation alone does not preserve status."
    ].join("\n");
    const out = stripRedundantRepeats(body);
    check("a bullet with a first-time line is kept", out.includes("and LCA preparation alone"), out);
    check("a later full repeat is dropped", count(out, LCA) === 1, out);
  }

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
