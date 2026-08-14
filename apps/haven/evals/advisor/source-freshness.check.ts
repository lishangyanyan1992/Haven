/**
 * Freshness audit for the official-source corpus.
 *
 * Every Advisor answer is grounded in `trustedKnowledgeDocuments` and cites the
 * agency URL the chunk came from. The citation makes the answer feel checkable —
 * it names USCIS, it links the page — but what the model actually read is our
 * stored copy of that page, and nothing in the product records when that copy was
 * last compared against the live one.
 *
 * The corpus does carry a `versionLabel`, and it is worse than nothing on this
 * question: fifteen of the twenty-one documents say "2026 evergreen", which
 * asserts the content cannot go out of date. USCIS edits policy-manual chapters
 * and processing pages without changing a URL and without announcing it. So the
 * field that looks like a freshness signal is in fact an untested claim that
 * freshness does not apply.
 *
 * This check reads `lastVerified` — the date a human actually opened the URL — and
 * reports every document as fresh, stale, or never verified against
 * `SOURCE_FRESHNESS_POLICY_DAYS`.
 *
 * IT FAILS ON A CLEAN CHECKOUT, AND THAT IS THE POINT. Twenty-one of twenty-one
 * documents are unverified today. That is the true state of the corpus; the check
 * exists to make it visible and to drive it to zero, one document at a time. Do
 * not backfill `lastVerified` to make this pass — a guessed date silences the
 * warning without doing the work it stands for. Open the URL, compare it to
 * `chunks`, then stamp the date you did it.
 *
 * Run: npm run check:source-freshness
 */

export {};

type Status = "fresh" | "stale" | "unverified" | "malformed";

type Row = {
  slug: string;
  topic: string;
  status: Status;
  ageDays: number | null;
  limitDays: number;
  url: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

async function main() {
  const { trustedKnowledgeDocuments, SOURCE_FRESHNESS_POLICY_DAYS, DEFAULT_SOURCE_FRESHNESS_DAYS } = await import(
    "@/lib/advisor/source-corpus"
  );

  const now = new Date();
  const rows: Row[] = [];

  for (const document of trustedKnowledgeDocuments) {
    const limitDays = SOURCE_FRESHNESS_POLICY_DAYS[document.topic] ?? DEFAULT_SOURCE_FRESHNESS_DAYS;
    const raw = document.lastVerified;

    if (!raw) {
      rows.push({ slug: document.slug, topic: document.topic, status: "unverified", ageDays: null, limitDays, url: document.url });
      continue;
    }

    // A malformed date is reported separately rather than swallowed. `new Date`
    // accepts a surprising amount of garbage and returns something plausible for
    // some of it, which would turn a typo into a false "fresh".
    if (!ISO_DATE.test(raw) || Number.isNaN(new Date(raw).getTime())) {
      rows.push({ slug: document.slug, topic: document.topic, status: "malformed", ageDays: null, limitDays, url: document.url });
      continue;
    }

    const ageDays = daysBetween(new Date(raw), now);
    rows.push({
      slug: document.slug,
      topic: document.topic,
      // A future date is a typo, not a very fresh document.
      status: ageDays < 0 ? "malformed" : ageDays > limitDays ? "stale" : "fresh",
      ageDays,
      limitDays,
      url: document.url
    });
  }

  // Worst first: the reader should see what needs doing without scrolling.
  const order: Record<Status, number> = { malformed: 0, stale: 1, unverified: 2, fresh: 3 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.topic.localeCompare(b.topic) || a.slug.localeCompare(b.slug));

  const label: Record<Status, string> = {
    fresh: "FRESH",
    stale: "STALE",
    unverified: "UNVERIFIED",
    malformed: "BAD DATE"
  };

  for (const row of rows) {
    const age =
      row.status === "unverified"
        ? "never checked"
        : row.ageDays == null
          ? "unparseable lastVerified"
          : `${row.ageDays}d old, limit ${row.limitDays}d`;
    console.log(`${label[row.status].padEnd(10)}  ${row.slug}\n            ${row.topic} · ${age}\n            ${row.url}`);
  }

  const counts = rows.reduce<Record<Status, number>>(
    (acc, row) => ({ ...acc, [row.status]: acc[row.status] + 1 }),
    { fresh: 0, stale: 0, unverified: 0, malformed: 0 }
  );

  console.log(
    `\n${rows.length} documents: ${counts.fresh} fresh, ${counts.stale} stale, ` +
      `${counts.unverified} never verified, ${counts.malformed} bad dates`
  );

  const failing = counts.stale + counts.unverified + counts.malformed;
  if (failing > 0) {
    console.log(
      `\n${failing} document(s) need a human to open the URL, compare it to the stored chunks,\n` +
        "and set lastVerified to the date they did it. Do not set it to today without looking."
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
