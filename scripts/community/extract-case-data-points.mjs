// extract-case-data-points.mjs
// PROTOTYPE backfill: LLM-extract structured case fields from the scraped stories in
// community_import_items → community_case_data_points, tagged source='imported_prototype'.
//
// These rows are TEST DATA ONLY. aggregate_case_outcomes() filters them out
// (source in 'first_party','consented'), so they NEVER appear in any public stat.
//
// Idempotent: deletes existing imported_prototype rows first, then reloads.
// Only inserts cases the model judges applicable to the H-1B/employment layoff wedge
// (the corpus also contains off-wedge marriage-GC stories, which are skipped).
//
// Run:  node --env-file=.env.local scripts/community/extract-case-data-points.mjs
//       (add --dry-run to print extractions without writing)

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const SOURCE = "imported_prototype";
const VERIFICATION = "forum_imported";

const STATUS = ["h1b", "f1_opt", "l1", "other"];
const PATHS = ["h1b_transfer", "h4_cos", "b2_cos", "o1", "consular", "departed", "day1_cpt", "undecided"];
const OUTCOMES = ["approved", "denied", "rfe", "noid", "pending"];

function readObject(value) {
  return typeof value === "object" && value !== null ? value : {};
}
function readString(value) {
  return typeof value === "string" ? value.trim() : "";
}
function oneOf(value, allowed) {
  const v = readString(value).toLowerCase();
  return allowed.includes(v) ? v : null;
}
function parseDate(value) {
  const raw = readString(value);
  if (!raw) return null;
  // accept YYYY-MM-DD or YYYY-MM (assume first of month)
  const norm = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw;
  const d = new Date(norm);
  return Number.isNaN(d.getTime()) ? null : d;
}
function diffDays(a, b) {
  if (!a || !b) return null;
  const days = Math.round((a.getTime() - b.getTime()) / 86400000);
  return Number.isFinite(days) ? days : null;
}
// Drop implausible deltas (LLM date-ordering errors) so they don't poison medians.
function sanitizeDelta(days, min, max) {
  if (days == null) return null;
  return days >= min && days <= max ? days : null;
}
function latestDate(dates) {
  const valid = dates.filter(Boolean).sort((x, y) => y.getTime() - x.getTime());
  return valid[0] ?? null;
}
function isoDateOnly(d) {
  return d ? d.toISOString().slice(0, 10) : null;
}

const SYSTEM_PROMPT = [
  "You extract STRUCTURED immigration case data from anonymized forum story summaries.",
  "Only consider cases relevant to the H-1B / employment-based layoff & status wedge.",
  "If the story is NOT about that (e.g., marriage/family green card), set applicable=false.",
  "Use ONLY the allowed enum values; if a field is genuinely unknown, return null.",
  `current_status ∈ ${JSON.stringify(STATUS)}.`,
  `path_taken ∈ ${JSON.stringify(PATHS)} (what the person DID after their job/status event).`,
  `outcome ∈ ${JSON.stringify(OUTCOMES)}.`,
  "nationality_bucket ∈ ['india','china','row'].  category ∈ ['eb1','eb2','eb3'].",
  "trigger ∈ ['laid_off','quit','opt_ending','other'].",
  "Dates as YYYY-MM-DD (or YYYY-MM) when stated; else null. Do not guess dates.",
  "Never invent facts not in the text."
].join(" ");

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "applicable", "current_status", "green_card_stage", "i140_status", "category",
    "nationality_bucket", "trigger", "path_taken", "outcome", "got_rfe", "got_noid",
    "premium_processing", "last_working_day", "filed_date", "decision_date", "notes"
  ],
  properties: {
    applicable: { type: "boolean" },
    current_status: { type: ["string", "null"] },
    green_card_stage: { type: ["string", "null"] },
    i140_status: { type: ["string", "null"] },
    category: { type: ["string", "null"] },
    nationality_bucket: { type: ["string", "null"] },
    trigger: { type: ["string", "null"] },
    path_taken: { type: ["string", "null"] },
    outcome: { type: ["string", "null"] },
    got_rfe: { type: ["boolean", "null"] },
    got_noid: { type: ["boolean", "null"] },
    premium_processing: { type: ["boolean", "null"] },
    last_working_day: { type: ["string", "null"] },
    filed_date: { type: ["string", "null"] },
    decision_date: { type: ["string", "null"] },
    notes: { type: ["string", "null"] }
  }
};

function storyText(item) {
  const priv = readObject(item.source_payload_private);
  const draft = readObject(item.publish_draft);
  const title = readString(priv.title) || readString(draft.title);
  const body = readString(priv.body) || readString(draft.body);
  const comments = Array.isArray(priv.comments)
    ? priv.comments.map((c) => readString(typeof c === "string" ? c : readObject(c).body)).filter(Boolean)
    : [];
  return [title, body, comments.length ? `Comments: ${comments.join(" | ")}` : ""].filter(Boolean).join("\n");
}

async function extract(openai, model, text) {
  const response = await openai.responses.create({
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: SYSTEM_PROMPT }] },
      { role: "user", content: [{ type: "input_text", text }] }
    ],
    text: { format: { type: "json_schema", name: "case_data_point", strict: true, schema: EXTRACTION_SCHEMA } }
  });
  return JSON.parse(response.output_text ?? "{}");
}

function toRow(parsed) {
  const currentStatus = oneOf(parsed.current_status, STATUS);
  const pathTaken = oneOf(parsed.path_taken, PATHS);
  // current_status and path_taken are NOT NULL + checked enums — skip rows we can't pin down.
  if (!parsed.applicable || !currentStatus || !pathTaken) return null;

  const lastWorkingDay = parseDate(parsed.last_working_day);
  const filedDate = parseDate(parsed.filed_date);
  const decisionDate = parseDate(parsed.decision_date);

  return {
    current_status: currentStatus,
    green_card_stage: oneOf(parsed.green_card_stage, ["none", "perm", "i140_pending", "i140_approved", "i485_filed"]),
    i140_status: oneOf(parsed.i140_status, ["none", "pending", "approved"]),
    category: oneOf(parsed.category, ["eb1", "eb2", "eb3"]),
    nationality_bucket: oneOf(parsed.nationality_bucket, ["india", "china", "row"]),
    trigger: oneOf(parsed.trigger, ["laid_off", "quit", "opt_ending", "other"]),
    path_taken: pathTaken,
    outcome: oneOf(parsed.outcome, OUTCOMES),
    got_rfe: typeof parsed.got_rfe === "boolean" ? parsed.got_rfe : null,
    got_noid: typeof parsed.got_noid === "boolean" ? parsed.got_noid : null,
    premium_processing: typeof parsed.premium_processing === "boolean" ? parsed.premium_processing : null,
    time_to_file_days: sanitizeDelta(diffDays(filedDate, lastWorkingDay), -60, 400),
    time_to_decision_days: sanitizeDelta(diffDays(decisionDate, filedDate), 0, 1000),
    notes: readString(parsed.notes) || null,
    case_date: isoDateOnly(latestDate([lastWorkingDay, filedDate, decisionDate])),
    source: SOURCE,
    verification: VERIFICATION,
    moderation_status: "approved"
  };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!supabaseUrl || !serviceRoleKey || !openAiKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENAI_API_KEY.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const openai = new OpenAI({ apiKey: openAiKey });
  const model = process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini";

  const { data: items, error } = await supabase
    .from("community_import_items")
    .select("id, source_payload_private, publish_draft");
  if (error) throw new Error(`Failed to read community_import_items: ${error.message}`);
  console.log(`Read ${items.length} import items.`);

  const rows = [];
  let skipped = 0;
  for (const item of items) {
    const text = storyText(item);
    if (!text) { skipped += 1; continue; }
    try {
      const parsed = await extract(openai, model, text);
      const row = toRow(parsed);
      if (row) rows.push(row); else skipped += 1;
    } catch (err) {
      console.warn(`  extract failed for ${item.id}: ${err.message}`);
      skipped += 1;
    }
  }

  console.log(`Extracted ${rows.length} applicable layoff-wedge cases; skipped ${skipped}.`);
  if (dryRun) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  // Idempotent: clear prior prototype rows, then reload.
  const { error: delErr } = await supabase.from("community_case_data_points").delete().eq("source", SOURCE);
  if (delErr) throw new Error(`Failed to clear prior prototype rows: ${delErr.message}`);

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("community_case_data_points").insert(rows);
    if (insErr) throw new Error(`Insert failed: ${insErr.message}`);
  }
  console.log(`Inserted ${rows.length} imported_prototype rows (excluded from all public stats).`);
}

await main();
