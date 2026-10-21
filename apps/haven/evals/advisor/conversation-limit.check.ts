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

  let failed = 0;
  for (const [email, want, name] of cases) {
    const ok = hasUnlimitedAdvisor(email) === want;
    if (!ok) failed += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  }

  console.log(`\n${cases.length - failed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
