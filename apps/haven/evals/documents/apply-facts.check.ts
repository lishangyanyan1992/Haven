/**
 * Rules for writing document details into the profile and green cards, and
 * for recording where each value came from. No database: the rules are pure.
 *
 * Run: npm run check:apply-facts
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export {};

async function main() {
  const { FACT_SETS } = await import("@/lib/document-facts/catalog");
  const { planFactApplication, sourceAfterPersonSave, labelFor, petitionFieldKey } = await import("@/lib/field-sources/plan");
  const { pagesFromChunks } = await import("@/lib/document-facts/run");
  type FieldSource = import("@/lib/field-sources/plan").FieldSource;

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const acme = { id: "pet-acme", sponsorName: "Acme Insurance", petitionType: "employer_sponsored" as const, preferenceCategory: "EB-2" as const, stage: "i140_filed" as const };
  const i140Facts = (over: Record<string, Partial<{ value: string | null; confident: boolean }>> = {}) =>
    [
      ["f1", "i140.sponsor", "ACME INSURANCE"],
      ["f2", "i140.priority_date", "2021-06-14"],
      ["f3", "i140.approval_date", "2023-03-03"],
      ["f4", "i140.category", "EB-2"]
    ].map(([id, key, value]) => ({ id, key, value, confident: true, page: 1, ...(over[key] ?? {}) }));
  const base = {
    set: FACT_SETS.i140,
    document: { id: "doc1", label: "I-140 notice", petitionId: null },
    profile: {},
    sources: new Map<string, FieldSource>(),
    hasI94StatusDate: false,
    newPetitionId: (name: string) => `doc-${name.toLowerCase().replace(/\W+/g, "-")}`
  };
  const pdKey = petitionFieldKey("pet-acme", "priorityDate");

  // 1. Empty field filled, routed by the sponsor name, stage moved forward.
  const p1 = planFactApplication({ ...base, facts: i140Facts(), petitions: [acme] });
  const acme1 = p1.petitions.find((p) => p.id === "pet-acme");
  check(
    "empty field: filled from the document, no confirm step",
    acme1?.priorityDate === "2021-06-14" && p1.sourceUpserts.find((s) => s.fieldKey === pdKey)?.origin === "document",
    JSON.stringify(p1)
  );
  check("routing: sponsor name on the document finds the green card", p1.petitionId === "pet-acme" && !p1.createdPetition);
  check("approval notice moves the stage forward to approved", acme1?.stage === "i140_approved");

  // 2. Same value a person typed: confirmed by the document.
  const typed = { ...acme, priorityDate: "2021-06-14" };
  const p2 = planFactApplication({ ...base, facts: i140Facts(), petitions: [typed] });
  check(
    "same value: confirmed, shown as from the document",
    p2.sourceUpserts.find((s) => s.fieldKey === pdKey)?.origin === "document" &&
      p2.outcomes.find((o) => o.factId === "f2")?.state === "filled"
  );

  // 3. Different value a person typed: kept, flagged.
  const differs = { ...acme, priorityDate: "2022-01-15" };
  const p3 = planFactApplication({ ...base, facts: i140Facts(), petitions: [differs] });
  const src3 = p3.sourceUpserts.find((s) => s.fieldKey === pdKey);
  check(
    "different person value: kept, document value beside it, open",
    p3.petitions[0].priorityDate === "2022-01-15" &&
      src3?.origin === "person" && src3.documentValue === "2021-06-14" && src3.resolution === "open" &&
      p3.outcomes.find((o) => o.factId === "f2")?.state === "not_used_person_value",
    JSON.stringify(src3)
  );

  // 3b. A value the document filled before is replaced on reread.
  const filledBefore = new Map<string, FieldSource>([[pdKey, { fieldKey: pdKey, origin: "document", value: "2022-01-15", documentFactId: "old", documentValue: null, documentLabel: "I-140 notice", documentPage: 1, resolution: null }]]);
  const p3b = planFactApplication({ ...base, facts: i140Facts(), petitions: [differs], sources: filledBefore });
  check("reread: a value the document filled is replaced", p3b.petitions[0].priorityDate === "2021-06-14");

  // 3c. "Keep mine" stays chosen when the same document value comes back.
  const keptMine = new Map<string, FieldSource>([[pdKey, { fieldKey: pdKey, origin: "person", value: "2022-01-15", documentFactId: "f2", documentValue: "2021-06-14", documentLabel: "I-140 notice", documentPage: 1, resolution: "kept_mine" }]]);
  const p3c = planFactApplication({ ...base, facts: i140Facts(), petitions: [differs], sources: keptMine });
  check("keep mine: not reopened by the same document value", p3c.sourceUpserts.find((s) => s.fieldKey === pdKey)?.resolution === "kept_mine");

  // 4. Unsure detail: not written.
  const p4 = planFactApplication({ ...base, facts: i140Facts({ "i140.priority_date": { confident: false } }), petitions: [acme] });
  check(
    "unsure: not written, left for a person",
    !p4.petitions[0].priorityDate && p4.outcomes.find((o) => o.factId === "f2")?.state === "needs_check"
  );

  // 5. New sponsor: green card created from the document.
  const p5 = planFactApplication({ ...base, facts: i140Facts({ "i140.sponsor": { value: "IBM" } }), petitions: [acme] });
  check(
    "new sponsor: new green card with the document's details",
    p5.createdPetition?.sponsorName === "IBM" &&
      p5.createdPetition.stage === "i140_approved" &&
      p5.petitions.length === 2 &&
      p5.petitions.find((p) => p.sponsorName === "IBM")?.priorityDate === "2021-06-14",
    JSON.stringify(p5.petitions)
  );
  check("new sponsor: the existing green card is untouched", JSON.stringify(p5.petitions[0]) === JSON.stringify(acme));

  // 5b. A linked document goes to its link even if the name differs.
  const p5b = planFactApplication({ ...base, facts: i140Facts({ "i140.sponsor": { value: "Acme Holdings Group" } }), petitions: [acme], document: { ...base.document, petitionId: "pet-acme" } });
  check("linked document: goes to its green card", p5b.petitionId === "pet-acme" && !p5b.createdPetition);

  // 6. I-94 beats H-1B for the status end date.
  const h1bFacts = [
    { id: "h1", key: "h1b.employer", value: "Harborline Systems LLC", confident: true, page: 1 },
    { id: "h2", key: "h1b.valid_to", value: "2027-10-15", confident: true, page: 1 },
    { id: "h3", key: "h1b.receipt_number", value: "WAC2412345678", confident: true, page: 1 }
  ];
  const p6 = planFactApplication({ ...base, set: FACT_SETS.h1b_approval, facts: h1bFacts, petitions: [], hasI94StatusDate: true, profile: {} });
  check(
    "I-94 present: H-1B end date is shown only",
    !("statusEndDate" in p6.profilePatch) && p6.outcomes.find((o) => o.factId === "h2")?.state === "no_target"
  );
  const p6b = planFactApplication({ ...base, set: FACT_SETS.h1b_approval, facts: h1bFacts, petitions: [], hasI94StatusDate: false, profile: {} });
  check("no I-94: H-1B end date fills the status end date", p6b.profilePatch.statusEndDate === "2027-10-15");
  check("receipt number: shown on the document only", p6b.outcomes.find((o) => o.factId === "h3")?.state === "no_target");
  const i94 = planFactApplication({
    ...base,
    set: FACT_SETS.i94,
    facts: [{ id: "i1", key: "i94.admit_until", value: "2027-09-30", confident: true, page: 1 }],
    petitions: [],
    profile: { statusEndDate: "2027-10-15" },
    sources: new Map([["statusEndDate", { fieldKey: "statusEndDate", origin: "document", value: "2027-10-15", documentFactId: "h2", documentValue: null, documentLabel: "H-1B approval notice", documentPage: 1, resolution: null }]])
  });
  check("I-94 replaces a status end date the H-1B approval filled", i94.profilePatch.statusEndDate === "2027-09-30");

  // 6b. Visa class the profile can't hold is shown only.
  const f1 = planFactApplication({ ...base, set: FACT_SETS.i94, facts: [{ id: "i2", key: "i94.class_of_admission", value: "F1", confident: true, page: 1 }], petitions: [] });
  check("visa class F1: shown only", f1.outcomes[0].state === "no_target" && !f1.profilePatch.visaType);

  // 6c. A value typed before sources existed counts as typed.
  const onboard = planFactApplication({ ...base, set: FACT_SETS.passport, facts: [{ id: "c1", key: "passport.country_of_birth", value: "India", confident: true, page: 1 }], petitions: [], profile: { countryOfBirth: "Nepal" } });
  check("value from setup with no record: treated as typed, not replaced", !onboard.profilePatch.countryOfBirth && onboard.sourceUpserts[0].resolution === "open");

  // 7. People saving fields.
  const docSource: FieldSource = { fieldKey: "x", origin: "document", value: "2023-03-03", documentFactId: "f3", documentValue: null, documentLabel: "I-140 notice", documentPage: 1, resolution: null };
  const changed = sourceAfterPersonSave("x", "2023-03-03", "2023-03-13", docSource);
  check(
    "overwrite: kept as the person's, document value beside it",
    changed?.origin === "person" && changed.value === "2023-03-13" && changed.documentValue === "2023-03-03" && changed.resolution === "kept_mine"
  );
  check(
    "overwrite label reads as the spec says",
    labelFor(changed ?? undefined).text === "You changed this. Your I-140 notice says 2023-03-03",
    labelFor(changed ?? undefined).text
  );
  check("unchanged save of a document value: nothing recorded", sourceAfterPersonSave("x", "2023-03-03", "2023-03-03", docSource) === null);
  const deleted: FieldSource = { ...docSource, origin: "document_deleted", documentFactId: null };
  check("saving a value from a deleted document makes it the person's", sourceAfterPersonSave("x", "2023-03-03", "2023-03-03", deleted)?.origin === "person");
  check("labels: document, typed, deleted", labelFor(docSource).text === "From your I-140 notice, page 1" && labelFor(undefined).text === "You entered this" && labelFor(deleted).text === "From a document you deleted — please confirm");
  const openSource: FieldSource = { ...docSource, origin: "person", value: "2022-01-15", documentValue: "2021-06-14", resolution: "open" };
  const openLabel = labelFor(openSource);
  check("open disagreement: both actions offered", openLabel.canUseDocument && openLabel.canKeepMine && openLabel.text === "Your I-140 notice says 2021-06-14");

  // 7b. Deleting a document.
  const { sourceAfterDocumentDeleted } = await import("@/lib/field-sources/plan");
  const filled: FieldSource = { fieldKey: pdKey, origin: "document", value: "2021-06-14", documentFactId: "f2", documentValue: null, documentLabel: "I-140 notice", documentPage: 1, resolution: null };
  const afterDelete = sourceAfterDocumentDeleted(filled, new Set(["f2"]));
  check(
    "delete: value kept, labeled deleted, then saving makes it the person's",
    afterDelete?.origin === "document_deleted" && afterDelete.value === "2021-06-14" &&
      labelFor(afterDelete).text === "From a document you deleted — please confirm" &&
      labelFor(sourceAfterPersonSave(pdKey, "2021-06-14", "2021-06-14", afterDelete) ?? undefined).text === "You entered this"
  );
  const disagreement: FieldSource = { ...filled, origin: "person", value: "2022-01-15", documentValue: "2021-06-14", resolution: "open" };
  const cleared = sourceAfterDocumentDeleted(disagreement, new Set(["f2"]));
  check("delete: a disagreement with only that document goes away", cleared?.resolution === null && cleared.documentValue === null && labelFor(cleared).text === "You entered this");
  check("delete: other documents' fields untouched", sourceAfterDocumentDeleted(filled, new Set(["other"])) === null);

  // 7c. Resolving, undoing, and removing a green card.
  const kept: FieldSource = { ...openSource, resolution: "kept_mine" };
  check("keep mine: warning gone, can still switch to the document", !labelFor(kept).open && labelFor(kept).canUseDocument);
  const usedDoc: FieldSource = { ...openSource, origin: "document", value: "2021-06-14", documentValue: null, resolution: null };
  const undone = sourceAfterPersonSave("x", "2021-06-14", "2022-01-15", usedDoc);
  check("use document, then change back: undone, labeled as changed", undone?.origin === "person" && undone.documentValue === "2021-06-14");
  const { petitionEdits } = await import("@/lib/field-sources/person");
  const pe = petitionEdits([acme, { ...acme, id: "pet-gone" }], [{ ...acme, priorityDate: "2022-03-03" }]);
  check(
    "green card editor: changed field and removed green card found",
    pe.removed.join() === "pet-gone" && pe.edits.some((e) => e.fieldKey === pdKey && e.next === "2022-03-03"),
    JSON.stringify(pe)
  );
  const actions = readFileSync(resolve(process.cwd(), "src/server/field-source-actions.ts"), "utf8");
  check(
    "resolve actions: each checks the signed-in user first",
    (actions.match(/const userId = await currentUserId\(\);\s*if \(!userId\)/g) ?? []).length === 2
  );

  // 7d. What Haven took, and the lawyer's list.
  const { describeFacts, disagreementsFrom } = await import("@/lib/document-facts/describe");
  const stored = [
    { id: "f2", documentId: "doc1", key: "i140.priority_date", value: "2021-06-14", rawText: "06/14/2022", page: 1, confident: true, state: "filled" as const, appliedTo: pdKey },
    { id: "f1", documentId: "doc1", key: "i140.sponsor", value: "IBM", rawText: "IBM", page: 1, confident: true, state: "filled" as const, appliedTo: petitionFieldKey("doc-ibm", "sponsorName") },
    { id: "f5", documentId: "doc1", key: "i140.receipt_number", value: null, rawText: "IOE09?2345678", page: 1, confident: false, state: "needs_check" as const, appliedTo: null }
  ];
  const created = new Map<string, FieldSource>([[petitionFieldKey("doc-ibm", "sponsorName"), { fieldKey: petitionFieldKey("doc-ibm", "sponsorName"), origin: "document", value: "IBM", documentFactId: "f1", documentValue: null, documentLabel: "I-140 notice", documentPage: 1, resolution: null }]]);
  const described = describeFacts(stored, new Map([["pet-acme", "Acme Insurance"], ["doc-ibm", "IBM"]]), created);
  check(
    "what Haven took: in list order, with where it went",
    described.lines[0].label === "Sponsor" &&
      described.lines.find((l) => l.label === "Priority date")?.outcome === "Filled into Acme Insurance's green card" &&
      described.lines.find((l) => l.label === "Receipt number")?.outcome === "Haven wasn't sure — please check" &&
      described.createdSponsor === "IBM",
    JSON.stringify(described)
  );
  const lawyer = disagreementsFrom(
    [kept, openSource, docSource],
    new Map([["f2", "doc1"], ["f3", "doc1"]]),
    new Map([["pet-acme", "Acme Insurance"]])
  );
  check(
    "lawyer: open disagreement first, then kept-mine, with both values",
    lawyer.length === 2 && lawyer[0].resolution === "open" && lawyer[1].resolution === "kept_mine" && lawyer[0].documentValue === "Jun 14, 2021",
    JSON.stringify(lawyer)
  );

  // 7e. An older green card with its own problem doesn't block a document.
  const { planPetitionSave } = await import("@/lib/petition-save");
  const broken = { ...acme, id: "pet-old", sponsorName: "Old Co", stage: "pwd_recruitment" as const, priorityDate: "2021-06-14" };
  const fixedOne = { ...acme, i140FiledDate: "2024-03-27" };
  check("whole-list save refuses an older broken green card", !planPetitionSave([fixedOne, broken], {}).ok);
  check("document save checks only the green card it changed", planPetitionSave([fixedOne, broken], {}, { onlyCheck: ["pet-acme"] }).ok);

  // 8. Pages rebuilt from stored passages, in order.
  const pages = pagesFromChunks([
    { page: 2, chunk_index: 2, content: "b2" },
    { page: 1, chunk_index: 1, content: "a2" },
    { page: 1, chunk_index: 0, content: "a1" }
  ]);
  check("pages from passages: grouped and ordered", JSON.stringify(pages) === JSON.stringify([{ page: 1, text: "a1\na2" }, { page: 2, text: "b2" }]));

  // 9. A failed details step never undoes the read.
  const store = readFileSync(resolve(process.cwd(), "src/lib/document-context/store.ts"), "utf8");
  const doneAt = store.indexOf('await finish("done"');
  const detailsAt = store.indexOf("await readDocumentDetails(documentId)");
  check(
    "reader: details run after the document is marked read, inside their own try",
    doneAt > 0 && detailsAt > doneAt && /try \{\s*await readDocumentDetails/.test(store)
  );

  console.log(`\n${pass}/${pass + failures.length} checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
