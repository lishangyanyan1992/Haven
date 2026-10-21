/**
 * Regression check: a saved question-and-answer must be a valid insert.
 *
 * Until October 2026 no Advisor message was ever stored in production. The user
 * row left out `retrieval_metadata`; supabase-js sends a multi-row insert as the
 * union of every row's keys and fills a missing key with NULL (not the column
 * default), and the column is NOT NULL, so Postgres rejected every insert. The
 * daily allowance still counted each conversation, and the list hid them all for
 * having no messages.
 *
 * This reads the table definition from the migration and checks the rows we
 * build against it: every row has the same keys, and no NOT NULL column is sent
 * as null. No network, no database.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildExchangeRows } from "@/lib/advisor/exchange-rows";
import type { AdvisorAnswerPayload } from "@/types/domain";

const migration = readFileSync(
  fileURLToPath(new URL("../../../../supabase/migrations/0002_advisor.sql", import.meta.url)),
  "utf8"
);

const table = migration.match(/create table public\.advisor_messages \(([\s\S]*?)\n\);/);
if (!table) {
  throw new Error("Could not find advisor_messages in 0002_advisor.sql");
}

const notNull = new Set<string>();
for (const line of table[1].split("\n")) {
  const column = line.trim().match(/^([a-z_]+)\s/);
  if (column && /not null|primary key/.test(line)) notNull.add(column[1]);
}

const failures: string[] = [];

const rows = buildExchangeRows({
  threadId: "00000000-0000-0000-0000-000000000000",
  userId: "00000000-0000-0000-0000-000000000001",
  question: "My last day is Friday. What happens to my OPT?",
  answer: { answer_markdown: "Here is what happens." } as AdvisorAnswerPayload,
  traceId: "trace-1"
});

const keySets = rows.map((row) => Object.keys(row).sort().join(","));
if (new Set(keySets).size !== 1) {
  failures.push(`rows have different keys, so missing ones are sent as NULL:\n  ${keySets.join("\n  ")}`);
}

const union = new Set(rows.flatMap((row) => Object.keys(row)));
for (const key of union) {
  if (!table[1].includes(`\n  ${key} `)) failures.push(`"${key}" is not a column of advisor_messages`);
}

rows.forEach((row, index) => {
  for (const key of union) {
    const value = (row as unknown as Record<string, unknown>)[key];
    if (notNull.has(key) && (value === undefined || value === null)) {
      failures.push(`row ${index} (${row.role}) sends NULL for NOT NULL column "${key}"`);
    }
  }
});

if (failures.length > 0) {
  console.error(`persist-exchange: ${failures.length} problem(s)\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(`persist-exchange: ok (${rows.length} rows, ${union.size} columns, NOT NULL: ${[...notNull].join(", ")})`);
