/**
 * Which accounts skip the daily conversation limit.
 *
 * Only the owner's account. The match is on the signed-in user's email, so the
 * cases below pin that it is exact (case and spacing aside) and that nothing
 * else, including an empty email, gets through.
 */

export {};

async function main() {
  const { hasUnlimitedAdvisor } = await import("@/lib/advisor/service");

  const cases: Array<[string | null | undefined, boolean, string]> = [
    ["lshangyanyan@gmail.com", true, "the owner's account"],
    ["  LShangYanyan@Gmail.com ", true, "case and spacing do not matter"],
    ["someone@example.com", false, "any other account"],
    ["lshangyanyan@gmail.com.evil.com", false, "a lookalike domain"],
    ["xlshangyanyan@gmail.com", false, "a lookalike address"],
    ["", false, "an empty email"],
    [null, false, "no email"]
  ];

  const results: Array<[string, boolean]> = cases.map(([email, want, name]) => [name, hasUnlimitedAdvisor(email) === want]);

  // What the limit actually decides: whether a sixth conversation may start, and
  // what the usage line says. These are the functions the live paths call
  // (reserveAdvisorConversation, getAdvisorUsage), so the exemption cannot quietly
  // stop reaching them.
  const { mayStartAdvisorConversation, summarizeAdvisorUsage } = await import("@/lib/advisor/service");
  const now = Date.parse("2026-10-21T15:00:00Z");
  const fiveRecent = [1, 2, 3, 4, 5].map((h) => new Date(now - h * 3_600_000).toISOString()).reverse();
  const owner = summarizeAdvisorUsage({ email: "lshangyanyan@gmail.com", recentCreatedAt: fiveRecent, nowMs: now });
  const other = summarizeAdvisorUsage({ email: "someone@example.com", recentCreatedAt: fiveRecent, nowMs: now });

  results.push(
    ["the owner with five recent conversations may start another", mayStartAdvisorConversation({ email: "lshangyanyan@gmail.com", recentCount: 5 })],
    ["another account with five recent conversations may not", !mayStartAdvisorConversation({ email: "someone@example.com", recentCount: 5 })],
    ["another account with four may start a fifth", mayStartAdvisorConversation({ email: "someone@example.com", recentCount: 4 })],
    ["the owner's usage says unlimited", owner.unlimited === true && owner.renewalLabel === "no limit"],
    ["another account's usage shows 0 left and no unlimited flag", other.remaining === 0 && other.used === 5 && !other.unlimited],
    ["another account's renewal is counted from its oldest conversation", other.nextRenewalAt === new Date(Date.parse(fiveRecent[0]) + 24 * 3_600_000).toISOString()]
  );

  let failed = 0;
  for (const [name, ok] of results) {
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  }

  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
