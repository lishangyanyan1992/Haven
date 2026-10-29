/**
 * Reading details from document text, with a stand-in for the model, so it is
 * free and runs offline. Every fixture is synthetic.
 *
 * Checks: values are normalized, bad values are kept but not trusted, details
 * outside the list are dropped, and documents with no list read nothing.
 *
 * Run: npm run check:fact-extraction
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export {};

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => fs.readFileSync(path.join(here, "fixtures", name), "utf8");

type StubFact = { key: string; found?: boolean; raw_text: string; page?: number; sure?: boolean };

/** A client whose reply is fixed, and which records what it was asked. */
function stub(facts: StubFact[]) {
  const calls: unknown[] = [];
  const client = {
    responses: {
      create: async (request: unknown) => {
        calls.push(request);
        return {
          output_text: JSON.stringify({
            facts: facts.map((f) => ({ found: true, page: 1, sure: true, ...f }))
          })
        };
      }
    }
  };
  return { client: client as never, calls };
}

async function main() {
  const { extractDocumentFacts, normalizeDate, normalizeCategory, normalizeReceipt } = await import(
    "@/lib/document-facts/extract"
  );

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };
  const byKey = (facts: Array<{ key: string }>, key: string) => facts.find((f) => f.key === key) as any;

  // 1. Formats
  check("dates: US, passport and ISO forms", normalizeDate("06/14/2022") === "2022-06-14" && normalizeDate("13 JUN 2032") === "2032-06-13" && normalizeDate("2024-02-09") === "2024-02-09");
  check(
    "dates: full month names, both orders",
    normalizeDate("June 14, 2021") === "2021-06-14" && normalizeDate("13 JUNE 2032") === "2032-06-13" && normalizeDate("March 3, 2023") === "2023-03-03" && normalizeDate("Sept. 9, 2024") === "2024-09-09",
    [normalizeDate("June 14, 2021"), normalizeDate("13 JUNE 2032"), normalizeDate("March 3, 2023"), normalizeDate("Sept. 9, 2024")].join()
  );
  check("dates: impossible date rejected", normalizeDate("02/30/2024") === null && normalizeDate("13/01/2024") === null);
  check("category: class codes and sections", normalizeCategory("E21") === "EB-2" && normalizeCategory("Sec.203(b)(1)") === "EB-1" && normalizeCategory("EW3") === "EB-3");
  check("receipt: spaces removed, bad shape rejected", normalizeReceipt("IOE 0912345678") === "IOE0912345678" && normalizeReceipt("IOE12345") === null);
  check("receipt: scanned 1/0 in the prefix read as I/O", normalizeReceipt("10E0925026854") === "IOE0925026854" && normalizeReceipt("EAC1234567890") === "EAC1234567890");

  // 2. I-140 approval notice
  const i140 = stub([
    { key: "i140.sponsor", raw_text: "NORTHWIND ANALYTICS INC" },
    { key: "i140.receipt_number", raw_text: "IOE0912345678" },
    { key: "i140.priority_date", raw_text: "06/14/2022" },
    { key: "i140.category", raw_text: "E21" },
    { key: "i140.filed_date", raw_text: "08/02/2024" },
    { key: "i140.approval_date", raw_text: "03/03/2025" },
    // Not on the list: must be dropped.
    { key: "i140.beneficiary_birth_date", raw_text: "01/01/1990" }
  ]);
  const r1 = await extractDocumentFacts({ documentKind: "i140_notice", pages: [{ page: 1, text: fixture("i797-i140-approval.txt") }] }, i140.client);
  check(
    "I-140: all six details normalized and trusted",
    r1.facts.length === 6 &&
      byKey(r1.facts, "i140.priority_date")?.value === "2022-06-14" &&
      byKey(r1.facts, "i140.category")?.value === "EB-2" &&
      byKey(r1.facts, "i140.approval_date")?.value === "2025-03-03" &&
      r1.facts.every((f) => f.confident && f.page === 1),
    JSON.stringify(r1.facts)
  );
  check("I-140: detail outside the list is dropped", !r1.facts.some((f) => f.key.includes("birth")));
  const schemaKeys = JSON.stringify((i140.calls[0] as any)?.text?.format?.schema ?? {});
  check("I-140: model is only offered the listed keys", schemaKeys.includes("i140.priority_date") && !schemaKeys.includes("birth"));

  // 3. Bad date and unsure value: kept, not trusted.
  const shaky = stub([
    { key: "i140.priority_date", raw_text: "06/1?/2022" },
    { key: "i140.receipt_number", raw_text: "IOE0912345678", sure: false },
    { key: "i140.filed_date", raw_text: "08/02/2024", page: 7 }
  ]);
  const r2 = await extractDocumentFacts({ documentKind: "i140_notice", pages: [{ page: 1, text: fixture("i797-i140-approval.txt") }] }, shaky.client);
  check(
    "bad date: value empty, not trusted, raw text kept",
    byKey(r2.facts, "i140.priority_date")?.value === null &&
      byKey(r2.facts, "i140.priority_date")?.confident === false &&
      byKey(r2.facts, "i140.priority_date")?.rawText === "06/1?/2022",
    JSON.stringify(r2.facts)
  );
  check("model unsure: not trusted", byKey(r2.facts, "i140.receipt_number")?.confident === false);
  check("page that doesn't exist: not trusted", byKey(r2.facts, "i140.filed_date")?.confident === false && byKey(r2.facts, "i140.filed_date")?.page === null);

  // 4. PERM, H-1B approval (as a general USCIS notice), I-94, passport.
  const perm = await extractDocumentFacts(
    { documentKind: "perm_certification", pages: [{ page: 1, text: fixture("perm-certification.txt") }] },
    stub([
      { key: "perm.employer", raw_text: "NORTHWIND ANALYTICS INC" },
      { key: "perm.filing_date", raw_text: "04/11/2023" },
      { key: "perm.certification_date", raw_text: "02/09/2024" }
    ]).client
  );
  check("PERM: three details", perm.set?.id === "perm" && byKey(perm.facts, "perm.certification_date")?.value === "2024-02-09");

  const h1b = await extractDocumentFacts(
    { documentKind: "uscis_notice", pages: [{ page: 1, text: fixture("i797-h1b-approval.txt") }] },
    stub([
      { key: "h1b.employer", raw_text: "HARBORLINE SYSTEMS LLC" },
      { key: "h1b.valid_to", raw_text: "09/30/2027" }
    ]).client
  );
  check("USCIS notice for I-129 reads as an H-1B approval", h1b.set?.id === "h1b_approval" && byKey(h1b.facts, "h1b.valid_to")?.value === "2027-09-30");

  const i94 = await extractDocumentFacts(
    { documentKind: "i94_record", pages: [{ page: 1, text: fixture("sample-i94.txt") }] },
    stub([
      { key: "i94.class_of_admission", raw_text: "H1B" },
      { key: "i94.admit_until", raw_text: "09/30/2027" }
    ]).client
  );
  check("I-94: visa type and status end date", byKey(i94.facts, "i94.class_of_admission")?.value === "H1B" && byKey(i94.facts, "i94.admit_until")?.value === "2027-09-30");

  const f1 = await extractDocumentFacts(
    { documentKind: "i94_record", pages: [{ page: 1, text: "Class of Admission: F1\nAdmit Until Date: D/S" }] },
    stub([{ key: "i94.class_of_admission", raw_text: "F1" }]).client
  );
  check("I-94: a class the profile can't hold is kept as read", byKey(f1.facts, "i94.class_of_admission")?.value === "F1");

  const passport = await extractDocumentFacts(
    { documentKind: "passport_biographic_page", pages: [{ page: 1, text: fixture("passport.txt") }] },
    stub([{ key: "passport.country_of_birth", raw_text: "REPUBLIC OF EXAMPLE" }]).client
  );
  check("passport: country of birth", byKey(passport.facts, "passport.country_of_birth")?.value === "Republic of Example");

  // 5. Paystub: nothing read, model never called.
  const none = stub([]);
  const pay = await extractDocumentFacts({ documentKind: "paystub", pages: [{ page: 1, text: "Pay period ..." }] }, none.client);
  check("paystub: no details and no model call", pay.set === null && pay.facts.length === 0 && none.calls.length === 0);

  console.log(`\n${pass}/${pass + failures.length} checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
