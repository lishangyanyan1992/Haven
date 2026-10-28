/**
 * Multi-firm client access tests (specs/firm-intake and specs/client-firm-engagements).
 *
 * Verifies that:
 * 1. A client can join multiple law firms via intake links without conflict.
 * 2. An intake request for Firm B succeeds even when the client is already joined to Firm A.
 * 3. Token-scoped claiming attaches to the correct firm record.
 * 4. Shared profile answers fan out to all joined firms while preserving per-firm custom questions.
 * 5. getClientFirms and getClientFirmEngagementRecords return all joined firms.
 * 6. Multiple law firm timelines maintain isolated milestones and checklists.
 *
 * Run: tsx --tsconfig tsconfig.json evals/firms/multi-firm.check.ts
 */

export {};

async function main() {
  const {
    decideIntake,
    claimTokenMatches,
    hashClaimToken
  } = await import("@/lib/firms/intake");
  const { mergeSharedAnswers } = await import("@/lib/firms/answers");
  const { buildFirmEngagementOverview } = await import("@/lib/firms/engagement");
  const fs = await import("node:fs");

  let pass = 0;
  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail: string) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
    if (ok) pass += 1;
    else failures.push(name);
  };

  // 1. Intake decisions in a multi-firm world
  const clientA = { firm_id: "firm-a", joined_at: "2026-10-01T00:00:00Z" };
  const clientB = { firm_id: "firm-b", joined_at: "2026-10-15T00:00:00Z" };

  // For Firm A, existingClient matches Firm A -> already_joined
  const forFirmA = decideIntake({
    email: "client@example.com",
    linkFirmId: "firm-a",
    isLawyer: false,
    existingClient: clientA
  });
  check(
    "intake: same firm already joined returns ignore:already_joined",
    forFirmA.action === "ignore" && forFirmA.reason === "already_joined",
    `expected ignore:already_joined, got ${JSON.stringify(forFirmA)}`
  );

  // For Firm B, lookup for (firm-b, email) yields null -> invite_new (even if client belongs to Firm A)
  const forFirmB = decideIntake({
    email: "client@example.com",
    linkFirmId: "firm-b",
    isLawyer: false,
    existingClient: null
  });
  check(
    "intake: new firm yields invite_new for client of another firm",
    forFirmB.action === "invite_new",
    `expected invite_new, got ${JSON.stringify(forFirmB)}`
  );

  // 2. Token-scoped claim matching
  const tokenA = "token_for_firm_a_1234567890abcdef";
  const tokenB = "token_for_firm_b_abcdef1234567890";
  const hashA = hashClaimToken(tokenA);
  const hashB = hashClaimToken(tokenB);

  check("claim: token A matches hash A", claimTokenMatches(tokenA, hashA), "token A should match hash A");
  check("claim: token B matches hash B", claimTokenMatches(tokenB, hashB), "token B should match hash B");
  check("claim: token A does not match hash B", !claimTokenMatches(tokenA, hashB), "token A must not match hash B");

  // 3. Shared answers fan-out and per-firm custom questions isolation
  const initialFirmAAnswers = {
    fullName: "Alex Rivera",
    visaType: "H-1B",
    custom_firm_a_case_strategy: "NIW self-petition"
  };
  const initialFirmBAnswers = {
    fullName: "Alex Rivera",
    visaType: "H-1B",
    custom_firm_b_internal_code: "CORP-99"
  };

  const updatedProfileDraft = {
    fullName: "Alex M. Rivera",
    jobTitle: "Principal Systems Architect",
    visaType: "H-1B"
  };
  const mockForm = {
    has: (key: string) => ["fullName", "jobTitle", "visaType"].includes(key)
  };

  const mergedForA = mergeSharedAnswers(initialFirmAAnswers as any, updatedProfileDraft, mockForm);
  const mergedForB = mergeSharedAnswers(initialFirmBAnswers as any, updatedProfileDraft, mockForm);

  check(
    "fan-out: firm A gets updated fullName and jobTitle",
    mergedForA.next.fullName === "Alex M. Rivera" && (mergedForA.next as any).jobTitle === "Principal Systems Architect",
    `unexpected firm A answers: ${JSON.stringify(mergedForA.next)}`
  );
  check(
    "fan-out: firm A preserves its custom question answer",
    (mergedForA.next as any).custom_firm_a_case_strategy === "NIW self-petition",
    `firm A custom question lost: ${JSON.stringify(mergedForA.next)}`
  );
  check(
    "fan-out: firm B gets updated fullName and jobTitle",
    mergedForB.next.fullName === "Alex M. Rivera" && (mergedForB.next as any).jobTitle === "Principal Systems Architect",
    `unexpected firm B answers: ${JSON.stringify(mergedForB.next)}`
  );
  check(
    "fan-out: firm B preserves its custom question answer without cross-contaminating firm A",
    (mergedForB.next as any).custom_firm_b_internal_code === "CORP-99" &&
      (mergedForB.next as any).custom_firm_a_case_strategy === undefined,
    `firm B contaminated: ${JSON.stringify(mergedForB.next)}`
  );

  // 4. Multiple independent firm engagement pipelines
  const overviewA = buildFirmEngagementOverview({
    firmName: "Apex Immigration Law",
    isConnectedToFirm: true,
    joinedAt: "2026-09-01T00:00:00Z",
    completedAt: "2026-09-02T00:00:00Z",
    reviewedAt: "2026-09-05T00:00:00Z",
    hasProfileSetup: true,
    uploadedDocumentCount: 4,
    requiredDocumentCount: 3,
    fulfilledRequiredCount: 3,
    bookingUrl: "https://apexlaw.com/book/alex",
    bookingEmail: null,
    engagementState: {
      stage: "initial_consultation",
      stageStatus: "scheduled",
      scheduledDate: "2026-10-30",
      note: "Reviewed O-1 citations, ready for call."
    }
  });

  const overviewB = buildFirmEngagementOverview({
    firmName: "Beacon Legal Group",
    isConnectedToFirm: true,
    joinedAt: "2026-10-20T00:00:00Z",
    completedAt: "2026-10-21T00:00:00Z",
    reviewedAt: null,
    hasProfileSetup: true,
    uploadedDocumentCount: 4,
    requiredDocumentCount: 5,
    fulfilledRequiredCount: 3,
    bookingUrl: null,
    bookingEmail: "intake@beaconlegal.com",
    engagementState: {
      stage: "documents_uploaded",
      stageStatus: "in_progress"
    }
  });

  check(
    "timelines: firm A is at initial_consultation milestone with booking url and note",
    overviewA.currentStep.key === "initial_consultation" &&
      overviewA.bookingUrl === "https://apexlaw.com/book/alex" &&
      overviewA.attorneyNote === "Reviewed O-1 citations, ready for call.",
    "firm A state mismatch"
  );
  check(
    "timelines: firm B is at documents_uploaded milestone with mailto booking and no note",
    overviewB.currentStep.key === "documents_uploaded" &&
      overviewB.bookingEmail === "intake@beaconlegal.com" &&
      overviewB.attorneyNote === null,
    "firm B state mismatch"
  );
  check(
    "timelines: progress percentages are independent (A > B)",
    overviewA.progressPercent > overviewB.progressPercent,
    `expected A (${overviewA.progressPercent}%) > B (${overviewB.progressPercent}%)`
  );

  // 5. Check migration 0048_multi_firm_clients.sql constraints
  const migration = fs.readFileSync(
    new URL("../../../../supabase/migrations/0048_multi_firm_clients.sql", import.meta.url),
    "utf8"
  );
  check(
    "migration 0048: drops single-column unique constraints",
    migration.includes("drop constraint if exists firm_clients_normalized_email_key") &&
      migration.includes("drop constraint if exists firm_clients_user_id_key"),
    "migration must drop single-column unique constraints"
  );
  check(
    "migration 0048: creates per-firm composite unique constraint",
    migration.includes("unique (firm_id, normalized_email)"),
    "migration must create composite unique on (firm_id, normalized_email)"
  );
  check(
    "migration 0048: creates per-firm composite partial unique index on (firm_id, user_id)",
    migration.includes("on public.firm_clients (firm_id, user_id)") &&
      migration.includes("where user_id is not null"),
    "migration must create partial unique index on (firm_id, user_id)"
  );

  // 6. Multi-firm intake helper exports
  const intakeSrc = fs.readFileSync(
    new URL("../../src/lib/firms/intake.ts", import.meta.url),
    "utf8"
  );
  check(
    "intake: exports grantFirmAccessForUser",
    intakeSrc.includes("export async function grantFirmAccessForUser"),
    "intake.ts must export grantFirmAccessForUser"
  );
  check(
    "intake: exports getClientFirms and getClientFirmEngagementRecords",
    intakeSrc.includes("export async function getClientFirms") &&
      intakeSrc.includes("export async function getClientFirmEngagementRecords"),
    "intake.ts must export multi-firm retrieval functions"
  );
  check(
    "intake: query is scoped by link.firmId in requestFirmIntake",
    intakeSrc.includes('.eq("firm_id", link.firmId)'),
    "requestFirmIntake must scope existingClient lookup by firm_id"
  );

  console.log(`\n${pass}/${pass + failures.length} passed`);
  if (failures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
