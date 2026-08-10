// Marks this file a module, so `main` is file-scoped rather than global and does
// not collide with the identically-named entry point in the sibling checks.
export {};

async function main() {
  const { buildStaleBulletinNotice } = await import("@/lib/advisor/service");
  const snap = (label: string, ageDays: number) => ({
    bulletinLabel: label, bulletinYear: 2026, bulletinMonth: 4,
    pulledAt: "2026-04-01T00:33:05Z",
    sourceUrl: "https://travel.state.gov/x", ageDays
  });
  const K: any[] = [];
  let pass = 0, fail = 0;
  const t = (name: string, got: boolean, want: boolean) => {
    const ok = got === want;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (got ${got}, want ${want})`);
    ok ? pass++ : fail++;
  };

  t("stale live bulletin on bulletin question -> notice",
    Boolean(buildStaleBulletinNotice(["visa-bulletin"] as any, K, snap("April 2026", 128), "answer")), true);
  t("fresh live bulletin -> no notice",
    Boolean(buildStaleBulletinNotice(["visa-bulletin"] as any, K, snap("August 2026", 7), "answer")), false);
  t("boundary 45 days -> no notice",
    Boolean(buildStaleBulletinNotice(["visa-bulletin"] as any, K, snap("x", 45), "answer")), false);
  t("boundary 46 days -> notice",
    Boolean(buildStaleBulletinNotice(["visa-bulletin"] as any, K, snap("x", 46), "answer")), true);
  t("non-bulletin topic -> no notice (even when stale)",
    Boolean(buildStaleBulletinNotice(["student-status"] as any, K, snap("April 2026", 128), "answer")), false);
  t("no live data + no bulletin chunks -> no notice",
    Boolean(buildStaleBulletinNotice(["visa-bulletin"] as any, K, null, "answer")), false);
  t("already annotated -> not duplicated",
    Boolean(buildStaleBulletinNotice(["visa-bulletin"] as any, K, snap("April 2026", 128),
      "answer Note on bulletin data: ...")), false);

  const text = buildStaleBulletinNotice(["visa-bulletin"] as any, K, snap("April 2026", 128), "a");
  console.log("\nNOTICE TEXT:\n" + text);
  const named = Boolean(text && text.includes("April 2026") && text.includes("128 days old"));
  t("notice names the month and age", named, true);

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error("ERR:", e?.message ?? e); process.exit(1); });
