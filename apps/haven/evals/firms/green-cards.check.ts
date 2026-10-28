/**
 * Green cards shared with the client's law firm (specs/green-card-petitions).
 * Fictional names only.
 *
 * Run: npm run check:firm-green-cards
 */

export {};

async function main() {
  const { greenCardLine, greenCardLinesForFirm } = await import("@/lib/firms/green-cards");
  const { withSharedGreenCards, sharedAnswersFromProfile, mergeSharedAnswers } = await import("@/lib/firms/answers");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const approved = {
    id: "a",
    sponsorName: "Northwind Mutual",
    petitionType: "employer_sponsored",
    preferenceCategory: "EB-2",
    stage: "i140_approved",
    i140ApprovalDate: "2026-01-20",
    priorityDate: "2021-06-14"
  };
  const ended = {
    id: "b",
    sponsorName: "Harbor Ventures (Lakeside Insurance)",
    petitionKind: "employer_sponsored",
    category: "EB-2",
    stage: "pwd_recruitment",
    endedReason: "layoff",
    endedDate: "2026-10-08"
  };

  const lines = greenCardLinesForFirm([approved, ended]);
  check("one line per green card", lines.length === 2, JSON.stringify(lines));
  check(
    "approved line names sponsor, stage, date and priority date",
    lines[0] === "Northwind Mutual · EB-2 · I-140 approved Jan 20, 2026 · Priority date Jun 14, 2021",
    lines[0]
  );
  check(
    "ended line reads older field names and says how it ended",
    lines[1] === "Harbor Ventures (Lakeside Insurance) · EB-2 · Prevailing wage / recruitment · Ended at layoff Oct 8, 2026",
    lines[1]
  );
  check(
    "carried-over priority date is marked",
    greenCardLine({ ...approved, isPriorityDateRecaptured: true } as any).includes("(carried over)"),
    greenCardLine({ ...approved, isPriorityDateRecaptured: true } as any)
  );
  check("no petitions gives no lines", greenCardLinesForFirm(undefined).length === 0, "");
  check("record without a sponsor is skipped", greenCardLinesForFirm([{ id: "x", sponsorName: " " }]).length === 0, "");

  const current = { visaType: "H1B", greenCardSponsor: "Northwind Mutual" };
  const withCards = withSharedGreenCards(current, [approved, ended]);
  check("saving green cards adds the list", Array.isArray(withCards.greenCards) && withCards.greenCards.length === 2, JSON.stringify(withCards));
  check("saving green cards leaves other answers alone", withCards.visaType === "H1B" && withCards.greenCardSponsor === "Northwind Mutual", JSON.stringify(withCards));
  const cleared = withSharedGreenCards(withCards, []);
  check("removing every green card removes the list", !("greenCards" in cleared), JSON.stringify(cleared));

  const joined = sharedAnswersFromProfile({
    country_of_birth: "Canada",
    visa_type: "H1B",
    deadline_answers: { immigrantPetitions: [approved, ended] }
  });
  check("joining a firm shares green cards already on file", Array.isArray(joined.greenCards) && joined.greenCards.length === 2, JSON.stringify(joined));

  const fakeForm = { has: (key: string) => key === "visaType" };
  const { next } = mergeSharedAnswers(withCards, { visaType: "F1" }, fakeForm);
  check("a settings form save does not wipe the green card list", Array.isArray(next.greenCards) && next.greenCards.length === 2, JSON.stringify(next));

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
