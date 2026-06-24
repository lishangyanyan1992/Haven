import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { LangfuseSpanClient, LangfuseTraceClient } from "langfuse";

type LangfuseParent = LangfuseTraceClient | LangfuseSpanClient;

export type CaseStatsTier = "tier0" | "tier1" | "tier2";

export type CaseSegmentFilters = {
  currentStatus?: string | null;
  i140Status?: string | null;
  nationalityBucket?: string | null;
  category?: string | null;
  trigger?: string | null;
};

export type CasePathStat = {
  path: string;
  pathLabel: string;
  n: number;
  pct: number;
  approvedPct: number | null; // null unless tier2 AND enough resolved cases on this path
  rfePct: number | null;
  medianDaysToFile: number | null;
  medianDaysToDecision: number | null;
};

export type CaseStatsBlock = {
  tier: CaseStatsTier;
  totalN: number;
  segmentLabel: string;
  widened: boolean; // true if filters were dropped to reach a usable tier
  recencyMonths: number;
  showOutcomes: boolean; // tier2 gate
  paths: CasePathStat[]; // [] for tier0
  caveat: string;
};

// Policy knobs. MIN_CELL MUST equal the RPC's p_min_cell (0019_aggregate_case_outcomes.sql).
const MIN_CELL = 5;
const TIER1_MIN_TOTAL = 30; // show action distribution
const TIER2_MIN_TOTAL = 100; // also show outcome rates
const TIER2_MIN_RESOLVED_PER_PATH = 20; // need enough resolved cases to show an approval rate
const RECENCY_MONTHS = 24;

const PATH_LABELS: Record<string, string> = {
  h1b_transfer: "transferred their H-1B to a new employer",
  h4_cos: "filed for H-4",
  b2_cos: "filed a B-2 (visitor) bridge",
  o1: "pursued an O-1",
  consular: "went through consular processing",
  departed: "left the US",
  day1_cpt: "used Day-1 CPT",
  undecided: "were still deciding",
  other: "took another path (too few to break down)"
};

const STATUS_LABELS: Record<string, string> = { h1b: "H-1B", f1_opt: "F-1 OPT", l1: "L-1", other: "Other" };
const NATION_LABELS: Record<string, string> = { india: "India", china: "China", row: "Rest of World" };

type RpcRow = {
  total_n: number | string | null;
  path_taken: string;
  n: number | string | null;
  pct: number | string | null;
  resolved_n: number | string | null;
  approved_pct: number | string | null;
  rfe_pct: number | string | null;
  median_days_to_file: number | string | null;
  median_days_to_decision: number | string | null;
};

// Postgres numeric/double can come back as strings via supabase-js — coerce defensively.
function num(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function classifyDisclosureTier(totalN: number, pathCount: number): CaseStatsTier {
  if (pathCount === 0 || totalN < TIER1_MIN_TOTAL) return "tier0";
  if (totalN >= TIER2_MIN_TOTAL) return "tier2";
  return "tier1";
}

// Most-specific → least-specific. Keep current_status + i140_status as the spine (most outcome-relevant).
function wideningAttempts(f: CaseSegmentFilters): CaseSegmentFilters[] {
  return [
    f,
    { ...f, trigger: null },
    { ...f, trigger: null, category: null },
    { ...f, trigger: null, category: null, nationalityBucket: null }
  ];
}

function segmentLabel(f: CaseSegmentFilters): string {
  const parts = [
    f.currentStatus ? (STATUS_LABELS[f.currentStatus] ?? f.currentStatus) : null,
    f.i140Status ? `I-140 ${f.i140Status}` : null,
    f.nationalityBucket ? (NATION_LABELS[f.nationalityBucket] ?? f.nationalityBucket) : null,
    f.category ? f.category.toUpperCase() : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "people in a similar situation";
}

async function callRpc(f: CaseSegmentFilters, parent?: LangfuseParent): Promise<RpcRow[]> {
  const admin = createSupabaseAdminClient() as any;
  const span = parent?.span({ name: "aggregate-case-outcomes", input: f });
  const { data, error } = await admin.rpc("aggregate_case_outcomes", {
    p_current_status: f.currentStatus ?? null,
    p_i140_status: f.i140Status ?? null,
    p_nationality_bucket: f.nationalityBucket ?? null,
    p_category: f.category ?? null,
    p_trigger: f.trigger ?? null,
    p_min_cell: MIN_CELL,
    p_recency_months: RECENCY_MONTHS
  });
  span?.end({ output: { rows: Array.isArray(data) ? data.length : 0, error: error?.message } });
  return error || !Array.isArray(data) ? [] : (data as RpcRow[]);
}

export async function getCaseOutcomeStats(
  filters: CaseSegmentFilters,
  parent?: LangfuseParent
): Promise<CaseStatsBlock> {
  if (!hasSupabaseEnv) return tier0Block(filters, false);

  const attempts = wideningAttempts(filters);
  for (let index = 0; index < attempts.length; index += 1) {
    const rows = await callRpc(attempts[index], parent);
    const totalN = num(rows[0]?.total_n) ?? 0;
    const tier = classifyDisclosureTier(totalN, rows.length);
    if (tier !== "tier0") {
      return buildBlock(tier, rows, attempts[index], index > 0);
    }
  }
  return tier0Block(filters, true);
}

function buildBlock(
  tier: CaseStatsTier,
  rows: RpcRow[],
  used: CaseSegmentFilters,
  widened: boolean
): CaseStatsBlock {
  const showOutcomes = tier === "tier2";
  const paths: CasePathStat[] = rows.map((row) => {
    const enoughResolved = (num(row.resolved_n) ?? 0) >= TIER2_MIN_RESOLVED_PER_PATH;
    const gated = showOutcomes && enoughResolved;
    return {
      path: row.path_taken,
      pathLabel: PATH_LABELS[row.path_taken] ?? row.path_taken,
      n: num(row.n) ?? 0,
      pct: num(row.pct) ?? 0,
      approvedPct: gated ? num(row.approved_pct) : null,
      rfePct: gated ? num(row.rfe_pct) : null,
      medianDaysToFile: num(row.median_days_to_file),
      medianDaysToDecision: num(row.median_days_to_decision)
    };
  });

  return {
    tier,
    totalN: num(rows[0]?.total_n) ?? 0,
    segmentLabel: segmentLabel(used),
    widened,
    recencyMonths: RECENCY_MONTHS,
    showOutcomes,
    paths,
    caveat:
      `Anonymized self-reported outcomes from Haven users in the last ${RECENCY_MONTHS} months — ` +
      "what others did, not a recommendation. Confirm your options with an attorney."
  };
}

function tier0Block(filters: CaseSegmentFilters, attempted: boolean): CaseStatsBlock {
  return {
    tier: "tier0",
    totalN: 0,
    segmentLabel: segmentLabel(filters),
    widened: attempted,
    recencyMonths: RECENCY_MONTHS,
    showOutcomes: false,
    paths: [],
    caveat: "Not enough people match this profile yet to show reliable numbers."
  };
}

// Deterministic text injected into the LLM. The model may only restate these numbers — never compute its own.
export function renderStatsForPrompt(block: CaseStatsBlock): string {
  if (block.tier === "tier0") {
    return (
      `NO_STATS — fewer than ${TIER1_MIN_TOTAL} matching cases for "${block.segmentLabel}". ` +
      "Tell the user there isn't enough data for their exact profile yet, give general orientation, " +
      "and hand off to an attorney. DO NOT invent any numbers."
    );
  }

  const header =
    `Among ${block.totalN} Haven users (${block.segmentLabel}, last ${block.recencyMonths} months)` +
    (block.widened ? " [broadened to nearest segment]" : "") +
    ":";

  const lines = block.paths.map((path) => {
    let line = `- ${path.pct}% (${path.n}) ${path.pathLabel}`;
    if (path.approvedPct != null) line += `; ~${path.approvedPct}% approved`;
    if (path.rfePct != null) line += `, ~${path.rfePct}% hit an RFE`;
    if (path.medianDaysToDecision != null) line += `; median ${path.medianDaysToDecision}d to decision`;
    return line;
  });

  return [
    header,
    ...lines,
    "RULES: state these figures verbatim; never compute or estimate others; end with the attorney handoff."
  ].join("\n");
}
