/**
 * Sponsor-tied documents are asked once per sponsor, only once the case has
 * produced them, and uploads count only for the sponsor they are linked to.
 *
 * Run: npm run check:sponsor-checklist
 */

export {};

async function main() {
  const { expandRequiredDocuments } = await import("@/lib/sponsor-documents");
  const { normalizePetitions } = await import("@/lib/petitions");
  const { TWO_EMPLOYER_RAW_PETITIONS } = await import("../dashboard/fixtures");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  const items = [
    { key: "passport_biographic_page", label: "Passport biographic page" },
    { key: "i140_notice", label: "I-140 approval notice" },
    { key: "perm_certification", label: "PERM certification" },
    { key: "h1b_petition", label: "H-1B petition packet" }
  ];
  const twoApproved = [
    { id: "pet-a", sponsorName: "Acme Insurance", stage: "i140_approved" as const, i140ApprovalDate: "2024-03-01" },
    { id: "pet-b", sponsorName: "Birch Systems", stage: "i140_approved" as const, i140ApprovalDate: "2025-05-01" }
  ];

  // 1. Two approved sponsors: one I-140 and one PERM item each.
  const two = expandRequiredDocuments({ items, petitions: twoApproved, employerName: "Birch Systems", documents: [] });
  const i140s = two.entries.filter((e) => e.key === "i140_notice");
  check(
    "two sponsors: one I-140 item per sponsor, named with the sponsor",
    i140s.length === 2 &&
      i140s[0].label === "I-140 approval notice — Acme Insurance" &&
      i140s[1].label === "I-140 approval notice — Birch Systems" &&
      i140s.every((e) => e.status === "needed"),
    JSON.stringify(i140s)
  );
  check(
    "two sponsors: passport asked once, H-1B packet once for the current employer",
    two.entries.filter((e) => e.key === "passport_biographic_page").length === 1 &&
      two.entries.filter((e) => e.key === "h1b_petition").length === 1 &&
      two.entries.find((e) => e.key === "h1b_petition")?.label === "H-1B petition packet — Birch Systems",
    JSON.stringify(two.entries.map((e) => e.label))
  );

  // 2. Uploads count only for their linked sponsor; unlinked ones are surfaced.
  const withDocs = expandRequiredDocuments({
    items,
    petitions: twoApproved,
    documents: [
      { id: "d1", documentKind: "i140_notice", petitionId: "pet-b" },
      { id: "d2", documentKind: "i140_notice", petitionId: null }
    ]
  });
  const a = withDocs.entries.find((e) => e.id === "i140_notice:pet-a");
  const b = withDocs.entries.find((e) => e.id === "i140_notice:pet-b");
  check(
    "linked upload: only that sponsor's item is uploaded",
    a?.status === "needed" && b?.status === "uploaded" && b.documents.length === 1,
    JSON.stringify({ a, b })
  );
  check("unlinked upload with two sponsors is listed as needing a sponsor", withDocs.unlinked.map((d) => d.id).join() === "d2");

  // 3. Fixture: approved I-140 at one employer, second employer ended in prevailing wage.
  const fixture = normalizePetitions(
    TWO_EMPLOYER_RAW_PETITIONS.map((p) => (p.id === "pet-harbor-eb2" ? { ...p, endedReason: "layoff", endedDate: "2026-10-08" } : p))
  );
  const owner = expandRequiredDocuments({ items, petitions: fixture, employerName: "Harbor Ventures", documents: [] });
  const harbor = owner.entries.filter((e) => e.petitionId === "pet-harbor-eb2");
  check(
    "ended before PERM: its PERM and I-140 items are not needed yet, with the reason",
    harbor.length === 2 &&
      harbor.every((e) => e.status === "not_needed_yet" && e.reason === "Not needed yet: this case ended before PERM"),
    JSON.stringify(harbor)
  );
  const northwind = owner.entries.filter((e) => e.petitionId === "pet-northwind-eb2");
  check(
    "approved sponsor: PERM and I-140 are both asked",
    northwind.length === 2 && northwind.every((e) => e.status === "needed"),
    JSON.stringify(northwind)
  );

  // 4. No green card yet: one item, no sponsor name.
  const none = expandRequiredDocuments({ items, petitions: [], documents: [] });
  const noneI140 = none.entries.filter((e) => e.key === "i140_notice");
  check(
    "no green card: I-140 asked once without a sponsor name",
    noneI140.length === 1 && noneI140[0].label === "I-140 approval notice" && !noneI140[0].petitionId,
    JSON.stringify(noneI140)
  );

  // 5. Stage moves forward.
  const early = [{ id: "pet-c", sponsorName: "Cedar Co", stage: "perm_in_progress" as const }];
  const before = expandRequiredDocuments({ items, petitions: early, documents: [] });
  const after = expandRequiredDocuments({ items, petitions: [{ ...early[0], stage: "i140_filed" as const }], documents: [] });
  const statuses = (r: typeof before) =>
    r.entries.filter((e) => e.petitionId === "pet-c").map((e) => `${e.key}:${e.status}`).join();
  check(
    "stage gate: PERM in progress → neither asked; I-140 filed → both asked",
    statuses(before) === "i140_notice:not_needed_yet,perm_certification:not_needed_yet" &&
      statuses(after) === "i140_notice:needed,perm_certification:needed",
    `${statuses(before)} | ${statuses(after)}`
  );

  // 6. Single sponsor: an unlinked upload counts for it.
  const single = expandRequiredDocuments({
    items,
    petitions: [twoApproved[0]],
    documents: [{ id: "d3", documentKind: "i140_notice" }]
  });
  check(
    "single sponsor: unlinked upload counts for it",
    single.entries.find((e) => e.key === "i140_notice")?.status === "uploaded" && single.unlinked.length === 0
  );

  // 7. Count from the spec: passport + I-140 required, two sponsors with filed I-140s, passport + one I-140 uploaded.
  const count = expandRequiredDocuments({
    items: [items[0], items[1]],
    petitions: [
      { id: "p1", sponsorName: "Acme Insurance", stage: "i140_filed" },
      { id: "p2", sponsorName: "Birch Systems", stage: "i140_filed" }
    ],
    documents: [
      { id: "x1", documentKind: "passport_biographic_page" },
      { id: "x2", documentKind: "i140_notice", petitionId: "p1" }
    ]
  });
  check("count: 2 of 3 required", count.uploadedCount === 2 && count.requestedCount === 3, JSON.stringify(count));

  // 8. Custom per-sponsor item has no stage gate.
  const custom = expandRequiredDocuments({
    items: [{ key: "custom_letter", label: "Employment verification letter", isCustom: true, perSponsor: true }],
    petitions: [{ id: "p1", sponsorName: "Acme Insurance", stage: "pwd_recruitment" }],
    documents: []
  });
  check(
    "custom per-sponsor item: asked per sponsor at any stage",
    custom.entries.length === 1 && custom.entries[0].status === "needed" && custom.entries[0].sponsorName === "Acme Insurance",
    JSON.stringify(custom.entries)
  );

  // 9. The firm's shared copy carries the same sponsors, so the lawyer's checklist matches.
  const { greenCardSponsorsForFirm, parseFirmGreenCardSponsors } = await import("@/lib/firms/green-cards");
  const shared = parseFirmGreenCardSponsors(greenCardSponsorsForFirm(fixture));
  const firmSide = expandRequiredDocuments({ items, petitions: shared, employerName: "Harbor Ventures", documents: [] });
  check(
    "firm copy: same entries and counts as the client's own list",
    JSON.stringify(firmSide.entries.map((e) => [e.id, e.status])) === JSON.stringify(owner.entries.map((e) => [e.id, e.status])) &&
      firmSide.requestedCount === owner.requestedCount,
    JSON.stringify(firmSide.entries.map((e) => [e.id, e.status]))
  );
  check("firm copy: junk entries are skipped", parseFirmGreenCardSponsors(["not json", 3, "{}"]).length === 0);

  console.log(`\n${pass}/${pass + failures.length} checks passed.`);
  if (failures.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
