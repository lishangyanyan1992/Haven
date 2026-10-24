/**
 * Demo firm dataset check (specs/firm-demo).
 *
 * Verifies that the 50 simulated client personas provide:
 * 1. Exactly 50 personas
 * 2. Coverage across all 4 urgency tiers (~10 Urgent, ~15 Soon, ~12 Later, ~7 Unknown)
 * 3. Coverage across all statuses (finished with New badges, in_progress, signed_up, email_sent)
 * 4. Realistic visa mix (H-1B, F-1, O-1, L-1, TN, E-2, etc.)
 * 5. Relative date offsets dynamically resolve to valid countdowns
 *
 * Run: npm run check:firm-demo
 */

export {};

async function main() {
  const { DEMO_LEAD_TEMPLATES, buildDemoAnswers } = await import("@/lib/firms/demo");
  const { rankUrgency } = await import("@/lib/firms/urgency");
  const { firmClientStatus, isNewFirmClient } = await import("@/lib/firms/status");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail?: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // 1. Total count
  check("total personas is exactly 50", DEMO_LEAD_TEMPLATES.length === 50, `got ${DEMO_LEAD_TEMPLATES.length}`);

  // Test with fixed reference date
  const REF = new Date("2026-10-22T12:00:00Z");

  const tierCounts: Record<string, number> = { urgent: 0, soon: 0, later: 0, unknown: 0 };
  const statusCounts: Record<string, number> = { email_sent: 0, signed_up: 0, in_progress: 0, finished: 0 };
  let newFinishedCount = 0;
  const showcaseCount = DEMO_LEAD_TEMPLATES.filter((t) => t.showcaseIndex !== undefined).length;

  for (const t of DEMO_LEAD_TEMPLATES) {
    const answers = buildDemoAnswers(t, REF);
    const urgency = rankUrgency(answers, REF);
    tierCounts[urgency.tier] = (tierCounts[urgency.tier] ?? 0) + 1;

    // Simulate firm_client row status
    const fakeRow = {
      joined_at: t.status === "email_sent" ? null : "2026-10-20T00:00:00Z",
      completed_at: t.status === "finished" ? "2026-10-21T00:00:00Z" : null,
      reviewed_at: t.status === "finished" && !t.isNew ? "2026-10-22T00:00:00Z" : null
    };

    const status = firmClientStatus(fakeRow, answers);
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    if (isNewFirmClient(fakeRow)) newFinishedCount += 1;
  }

  // 2. Urgency tiers
  check("tier: urgent count is between 8 and 12", tierCounts.urgent >= 8 && tierCounts.urgent <= 12, `got ${tierCounts.urgent}`);
  check("tier: soon count is between 12 and 18", tierCounts.soon >= 12 && tierCounts.soon <= 18, `got ${tierCounts.soon}`);
  check("tier: later count is between 10 and 15", tierCounts.later >= 10 && tierCounts.later <= 15, `got ${tierCounts.later}`);
  check("tier: unknown count is between 10 and 16", tierCounts.unknown >= 10 && tierCounts.unknown <= 16, `got ${tierCounts.unknown}`);

  // 3. Statuses
  check("status: email_sent count is between 4 and 8", statusCounts.email_sent >= 4 && statusCounts.email_sent <= 8, `got ${statusCounts.email_sent}`);
  check("status: finished count is at least 25", statusCounts.finished >= 25, `got ${statusCounts.finished}`);
  check("status: in_progress count is at least 5", statusCounts.in_progress >= 5, `got ${statusCounts.in_progress}`);
  check("status: signed_up count is at least 1", statusCounts.signed_up >= 1, `got ${statusCounts.signed_up}`);
  check("status: new finished leads count is at least 5", newFinishedCount >= 5, `got ${newFinishedCount}`);

  // 4. Showcase leads
  check("showcase leads count is between 6 and 8", showcaseCount >= 6 && showcaseCount <= 8, `got ${showcaseCount}`);

  // 5. Unique emails
  const emails = new Set(DEMO_LEAD_TEMPLATES.map((t) => t.email.toLowerCase()));
  check("all 50 emails are unique", emails.size === 50, `got ${emails.size} unique emails`);

  // 6. Visa type enum mapping for showcase profiles
  const { toProfileVisaType, createSamplePdf, SHOWCASE_DOCUMENTS } = await import("@/lib/firms/demo");
  const validEnums = new Set(["OPT", "STEM OPT", "H1B", "H4", "O-1", "GC", "Citizen"]);
  check("visa enum: H-1B maps to H1B", toProfileVisaType("H-1B") === "H1B");
  check("visa enum: O-1A maps to O-1", toProfileVisaType("O-1A") === "O-1");
  check("visa enum: F-1 OPT maps to OPT", toProfileVisaType("F-1 OPT") === "OPT");
  check("visa enum: F-1 STEM OPT maps to STEM OPT", toProfileVisaType("F-1 STEM OPT") === "STEM OPT");
  const showcaseTemplates = DEMO_LEAD_TEMPLATES.filter((t) => t.showcaseIndex !== undefined);
  const allShowcaseEnumsValid = showcaseTemplates.every((t) => validEnums.has(toProfileVisaType(t.answers.visaType)));
  check("visa enum: all showcase profiles map to valid database enum", allShowcaseEnumsValid);

  // 7. Sample PDF generation
  const pdfBuf = createSamplePdf("TEST TITLE", "TEST SUBTITLE", "TEST DETAIL");
  const pdfStr = pdfBuf.toString("utf-8");
  check("pdf: starts with %PDF-1.4", pdfStr.startsWith("%PDF-1.4"));
  check("pdf: defines Font F1 Helvetica", pdfStr.includes("/Font") && pdfStr.includes("/Helvetica"));
  check("pdf: contains xref and %%EOF", pdfStr.includes("xref\n") && pdfStr.trimEnd().endsWith("%%EOF"));
  check("pdf: all showcase documents have valid definitions", Object.keys(SHOWCASE_DOCUMENTS).length === 8);

  // A demo lead has asked to be contacted, so the marker is visible in demos,
  // and the request holds what a real one would: built by the advisor's handoff.
  const { buildDemoContactRequest, DEMO_CONTACT_REQUEST_EMAIL } = await import("@/lib/firms/demo");
  const refDate = new Date("2026-10-23T15:00:00Z");
  const demoRequest = buildDemoContactRequest(refDate);
  check("demo contact request: belongs to a demo lead", DEMO_LEAD_TEMPLATES.some((t) => t.email === DEMO_CONTACT_REQUEST_EMAIL), DEMO_CONTACT_REQUEST_EMAIL);
  check("demo contact request: built", demoRequest !== null, "null");
  check("demo contact request: has the lead's dates", (demoRequest?.dates.length ?? 0) >= 1 && /60-day/.test(demoRequest?.dates[0] ?? ""), JSON.stringify(demoRequest?.dates));
  check("demo contact request: has questions", (demoRequest?.questions.length ?? 0) >= 3, JSON.stringify(demoRequest?.questions));
  check("demo contact request: sent before the reset time", new Date(demoRequest?.created_at ?? 0) < refDate, demoRequest?.created_at ?? "");

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
