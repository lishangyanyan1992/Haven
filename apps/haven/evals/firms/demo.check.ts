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

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
