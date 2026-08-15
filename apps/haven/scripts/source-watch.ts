/**
 * Watch the official sources for changes we would otherwise never notice.
 *
 * THE PROBLEM THIS SOLVES
 *
 * Every Advisor answer is grounded in a stored copy of a government page and
 * cites the agency URL it came from. The citation makes the answer look
 * checkable, but what the model read is our snapshot, and until now nothing
 * compared that snapshot to the live text. A regulation could be amended and the
 * product would keep citing the superseded rule, confidently, indefinitely.
 *
 * That is not hypothetical. When this script was written, 8 CFR 214.1 — the
 * grace-period rule, the single most load-bearing source in the product — had
 * been amended twice in the preceding month, both marked substantive, and
 * nothing in Haven had noticed either one.
 *
 * WHY THIS APPROACH AND NOT SCRAPING
 *
 * Scraping the agency pages does not work: uscis.gov returns 403 to automated
 * requests and eCFR's HTML redirects bot traffic to a challenge host. More
 * importantly it should not be the design. For a product whose value rests on
 * provenance, the freshness signal should come from the government's own
 * published record, not from a diff of rendered HTML that changes when a banner
 * rotates.
 *
 * Two official, free, documented APIs give exactly that:
 *
 *   eCFR versioner      the amendment history of a regulation section, including
 *                       whether each amendment was substantive
 *   Federal Register    the rules that caused those amendments, with abstracts
 *                       and — critically — future effective dates
 *
 * The Federal Register half is the one that earns its place. eCFR tells you a
 * rule has already changed. The Federal Register tells you a rule is *going to*
 * change and on what date, which is the difference between correcting an answer
 * after users read it and correcting it before.
 *
 * WHAT THIS DOES NOT COVER
 *
 * Only eCFR sections. The USCIS policy-manual and guidance pages — the majority
 * of the corpus — publish no version feed, so they still need a person. This
 * script deliberately reports how many of those there are rather than letting
 * a green run imply the whole corpus was checked.
 *
 * STATE
 *
 * `source-watch.json` records which Federal Register rules have been reviewed.
 * It is committed, so "we looked at this rule and decided it did not affect us"
 * is a reviewable claim in the history rather than something living in one
 * person's memory.
 *
 * Run: npm run watch:sources
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export {};

const STATE_FILE = path.join(process.cwd(), "scripts/source-watch.json");

/**
 * CFR parts worth watching, and why each one is here.
 *
 * Scoped to the two topics the Advisor answers. Watching every immigration part
 * would bury the signal — part 214 alone has 231 Federal Register documents.
 */
const WATCHED_PARTS: Array<{ title: number; part: string; why: string }> = [
  { title: 8, part: "214", why: "nonimmigrant status, grace period, H-1B portability" },
  { title: 8, part: "245", why: "adjustment of status, I-485 filing" },
  { title: 8, part: "204", why: "immigrant petitions, priority dates" }
];

/** How far back to look for rules on a first run with no recorded state. */
const LOOKBACK_DAYS = 180;

type WatchState = {
  /** Federal Register document numbers already reviewed, with the reviewer's note. */
  reviewed: Record<string, string>;
  lastRunAt?: string;
};

type Finding = {
  severity: "changed" | "upcoming" | "unknown";
  headline: string;
  detail: string[];
};

function readState(): WatchState {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8")) as WatchState;
  } catch {
    return { reviewed: {} };
  }
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      // Both APIs are public and unauthenticated. Identifying the caller is
      // courtesy, and it is what lets an agency contact us rather than block us
      // if this ever misbehaves.
      "User-Agent": "Haven source-watch (https://haven-h1b.com; immigration information tool)",
      Accept: "application/json"
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

/** Pull the eCFR title and section out of a stored corpus URL. */
function parseEcfrUrl(url: string): { title: string; section: string } | null {
  const match = /ecfr\.gov\/current\/title-(\d+)\/.*section-([\d.]+)/.exec(url);
  return match ? { title: match[1], section: match[2] } : null;
}

async function checkRegulations(findings: Finding[]) {
  const { trustedKnowledgeDocuments } = await import("@/lib/advisor/source-corpus");

  const ecfrDocs = trustedKnowledgeDocuments
    .map((doc) => ({ doc, ref: parseEcfrUrl(doc.url) }))
    .filter((entry): entry is { doc: (typeof trustedKnowledgeDocuments)[number]; ref: { title: string; section: string } } =>
      entry.ref !== null
    );

  console.log(`\n── Regulations (eCFR versioner) — ${ecfrDocs.length} of ${trustedKnowledgeDocuments.length} documents\n`);

  for (const { doc, ref } of ecfrDocs) {
    let meta: { latest_amendment_date?: string };
    try {
      const payload = (await getJson(
        `https://www.ecfr.gov/api/versioner/v1/versions/title-${ref.title}.json?section=${ref.section}`
      )) as { meta?: { latest_amendment_date?: string }; content_versions?: Array<{ amendment_date: string; substantive: boolean }> };
      meta = payload.meta ?? {};

      const live = meta.latest_amendment_date;
      const stored = doc.sourceAmendedOn;

      if (!live) {
        findings.push({
          severity: "unknown",
          headline: `${doc.slug}: eCFR returned no amendment date`,
          detail: [doc.url]
        });
        console.log(`  ?  ${doc.slug}\n     no latest_amendment_date in response`);
        continue;
      }

      if (!stored) {
        // Not a failure — it is the honest state of a corpus that has never been
        // version-stamped. Reported so it can be closed out, with the exact value
        // to write, which removes the temptation to guess one.
        findings.push({
          severity: "unknown",
          headline: `${doc.slug}: no sourceAmendedOn recorded`,
          detail: [`live amendment date is ${live}`, `set sourceAmendedOn: "${live}" once the chunks are confirmed against it`]
        });
        console.log(`  ?  ${doc.slug}\n     live ${live}, stored (none) — needs stamping`);
        continue;
      }

      if (live > stored) {
        const substantive = (
          (await getJson(
            `https://www.ecfr.gov/api/versioner/v1/versions/title-${ref.title}.json?section=${ref.section}`
          )) as { content_versions?: Array<{ amendment_date: string; substantive: boolean }> }
        ).content_versions
          ?.filter((v) => v.amendment_date > stored)
          .some((v) => v.substantive);

        findings.push({
          severity: "changed",
          headline: `${doc.slug}: regulation amended since our copy`,
          detail: [
            `our text reflects ${stored}, the section was amended ${live}`,
            substantive ? "at least one amendment is marked SUBSTANTIVE" : "amendments are marked non-substantive",
            doc.url
          ]
        });
        console.log(
          `  !  ${doc.slug}\n     ours ${stored} → live ${live}${substantive ? "  [SUBSTANTIVE]" : ""}`
        );
        continue;
      }

      console.log(`  ok ${doc.slug}\n     current as of ${stored}`);
    } catch (error) {
      findings.push({
        severity: "unknown",
        headline: `${doc.slug}: eCFR lookup failed`,
        detail: [(error as Error).message]
      });
      console.log(`  ?  ${doc.slug}\n     ${(error as Error).message}`);
    }
  }

  const unwatchable = trustedKnowledgeDocuments.length - ecfrDocs.length;
  console.log(
    `\n  ${unwatchable} document(s) have no version feed (USCIS policy pages, DOL) and still need a person.\n` +
      "  This script cannot see those change; npm run check:source-freshness tracks them."
  );
}

async function checkFederalRegister(state: WatchState, findings: Finding[]) {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  console.log(`\n── Rules in flight (Federal Register, published since ${since})\n`);

  for (const watched of WATCHED_PARTS) {
    const url =
      "https://www.federalregister.gov/api/v1/documents.json" +
      `?conditions%5Bcfr%5D%5Btitle%5D=${watched.title}` +
      `&conditions%5Bcfr%5D%5Bpart%5D=${watched.part}` +
      `&conditions%5Bpublication_date%5D%5Bgte%5D=${since}` +
      "&conditions%5Btype%5D%5B%5D=RULE" +
      "&order=newest&per_page=20" +
      "&fields%5B%5D=document_number&fields%5B%5D=title&fields%5B%5D=publication_date" +
      "&fields%5B%5D=effective_on&fields%5B%5D=html_url";

    try {
      const payload = (await getJson(url)) as {
        results?: Array<{
          document_number: string;
          title: string;
          publication_date: string;
          effective_on: string | null;
          html_url: string;
        }>;
      };
      const results = payload.results ?? [];
      const unreviewed = results.filter((rule) => !(rule.document_number in state.reviewed));

      console.log(`  8 CFR ${watched.part} — ${watched.why}`);
      if (results.length === 0) {
        console.log("     no rules published in the window\n");
        continue;
      }

      for (const rule of results) {
        const reviewed = rule.document_number in state.reviewed;
        // A rule whose effective date is still ahead of us is the valuable case:
        // there is time to update the corpus before anybody reads a stale answer.
        const upcoming = rule.effective_on != null && rule.effective_on > today;
        const mark = reviewed ? "ok" : upcoming ? "!!" : "! ";
        console.log(
          `     ${mark} ${rule.publication_date}  ${rule.title.slice(0, 88)}${rule.title.length > 88 ? "…" : ""}`
        );
        console.log(
          `        ${rule.document_number}` +
            (rule.effective_on ? ` · effective ${rule.effective_on}${upcoming ? " (NOT YET IN FORCE)" : ""}` : "") +
            (reviewed ? ` · reviewed: ${state.reviewed[rule.document_number]}` : "")
        );
      }
      console.log("");

      for (const rule of unreviewed) {
        const upcoming = rule.effective_on != null && rule.effective_on > today;
        findings.push({
          severity: upcoming ? "upcoming" : "changed",
          headline: `8 CFR ${watched.part}: ${rule.title.slice(0, 90)}`,
          detail: [
            `${rule.document_number}, published ${rule.publication_date}` +
              (rule.effective_on ? `, effective ${rule.effective_on}` : ""),
            rule.html_url
          ]
        });
      }
    } catch (error) {
      findings.push({
        severity: "unknown",
        headline: `Federal Register lookup failed for part ${watched.part}`,
        detail: [(error as Error).message]
      });
      console.log(`     lookup failed: ${(error as Error).message}\n`);
    }
  }
}

async function main() {
  const state = readState();
  const findings: Finding[] = [];

  await checkRegulations(findings);
  await checkFederalRegister(state, findings);

  const changed = findings.filter((f) => f.severity === "changed");
  const upcoming = findings.filter((f) => f.severity === "upcoming");
  const unknown = findings.filter((f) => f.severity === "unknown");

  console.log("\n── Summary\n");
  console.log(`  ${changed.length} already changed · ${upcoming.length} changing soon · ${unknown.length} unknown\n`);

  for (const finding of [...upcoming, ...changed]) {
    console.log(`  [${finding.severity}] ${finding.headline}`);
    for (const line of finding.detail) console.log(`      ${line}`);
  }

  if (unknown.length > 0) {
    console.log(`\n  ${unknown.length} item(s) could not be judged (no stored version, or a lookup failed).`);
  }

  if (process.argv.includes("--write-state")) {
    writeFileSync(STATE_FILE, JSON.stringify({ ...state, lastRunAt: new Date().toISOString() }, null, 2) + "\n");
    console.log(`\n  Updated ${path.relative(process.cwd(), STATE_FILE)}`);
  }

  if (changed.length > 0 || upcoming.length > 0) {
    console.log(
      "\n  To close one out: read the rule, update the affected chunks and sourceAmendedOn,\n" +
        "  then add the document number to scripts/source-watch.json with a one-line note.\n" +
        "  Recording a rule as reviewed is a claim that somebody read it."
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("ERR:", error?.message ?? error);
  process.exit(1);
});
