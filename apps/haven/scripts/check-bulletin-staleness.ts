import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { getPriorityDateIntelligence } = await import("@/lib/priority-date-intelligence");

  const base = {
    id: "check", fullName: "Check", email: "c@example.com", visaType: "H-1B",
    countryOfBirth: "India", permStage: "approved", i140Approved: true,
    preferenceCategory: "EB-2", i485Filed: false
  };

  // Two branches matter: a priority date already past the cutoff (no projection
  // is produced) and one still in the queue (a projection is produced, and that
  // projection is the value that reaches the Advisor's prompt).
  const current = await getPriorityDateIntelligence({ ...base, priorityDate: "2013-08-15" } as any);
  const queued = await getPriorityDateIntelligence({ ...base, priorityDate: "2023-01-01" } as any);
  if (!current || !queued) { console.log("No intelligence returned (no Supabase env or no rows)."); return; }

  const i = current;
  console.log("bulletin:", i.latestBulletinLabel, "| ageDays:", i.bulletinAgeDays, "| isStale:", i.isStale);
  console.log("\n[already current] visaBulletinPosition:\n ", i.visaBulletinPosition);
  console.log("\n[still queued] visaBulletinPosition:\n ", queued.visaBulletinPosition);
  console.log("\n[still queued] estimatedGreenCardDateRange (injected into the Advisor prompt):\n ", queued.estimatedGreenCardDateRange);
  console.log("\n[still queued] estimateLabel:\n ", queued.estimateLabel);

  const checks: [string, boolean][] = [
    ["isStale is true for 128-day-old data", i.isStale === true],
    ["bulletinAgeDays is populated", typeof i.bulletinAgeDays === "number" && i.bulletinAgeDays > 0],
    ["position carries the staleness caveat", (i.visaBulletinPosition ?? "").includes("stale")],
    ["position names the bulletin month", (i.visaBulletinPosition ?? "").includes(i.latestBulletinLabel)],
    ["queued position carries the caveat", (queued.visaBulletinPosition ?? "").includes("stale")],
    ["queued estimate range carries the caveat", (queued.estimatedGreenCardDateRange ?? "").includes("days old")],
    ["queued estimate label names the stale anchor", (queued.estimateLabel ?? "").includes("days old")],
    ["queued estimate details lead with the warning", Boolean(queued.estimateDetails?.[0]?.includes("has not ingested"))],
    ["position no longer claims the cutoff is simply 'Current ...'", !/^Current /.test(i.visaBulletinPosition ?? "")]
  ];
  let fail = 0;
  console.log("");
  for (const [name, ok] of checks) { console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); if (!ok) fail++; }
  console.log(`\n${checks.length - fail} passed, ${fail} failed`);
  if (fail) process.exit(1);
}
main().catch((e) => { console.error("ERR:", e?.message ?? e); process.exit(1); });
