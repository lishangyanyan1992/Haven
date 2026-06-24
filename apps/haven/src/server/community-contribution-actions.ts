"use server";

import crypto from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type ContributionActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const STATUS = ["h1b", "f1_opt", "l1", "other"];
const STAGE = ["none", "perm", "i140_pending", "i140_approved", "i485_filed"];
const PATHS = ["h1b_transfer", "h4_cos", "b2_cos", "o1", "consular", "departed", "day1_cpt", "undecided"];
const OUTCOMES = ["approved", "denied", "rfe", "noid", "pending"];
const NATIONS = ["india", "china", "row"];
const CATEGORIES = ["eb1", "eb2", "eb3"];
const TRIGGERS = ["laid_off", "quit", "opt_ending", "other"];

function field(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function pick(form: FormData, name: string, allowed: string[]): string | null {
  const v = field(form, name);
  return v && allowed.includes(v) ? v : null;
}
function checkbox(form: FormData, name: string): boolean | null {
  return form.get(name) != null ? true : null; // checked => true; absent => unknown
}
function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
function diffDays(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
function sanitizeDelta(days: number | null, min: number, max: number): number | null {
  if (days == null) return null;
  return days >= min && days <= max ? days : null;
}
function isoDate(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}
// I-140 status implied by the green-card stage the user selected.
function i140From(stage: string | null): string | null {
  if (stage === "i140_approved" || stage === "i485_filed") return "approved";
  if (stage === "i140_pending") return "pending";
  if (stage === "perm" || stage === "none") return "none";
  return null;
}

export async function submitCaseContribution(
  _prev: ContributionActionState,
  form: FormData
): Promise<ContributionActionState> {
  // Required (Tier 1)
  const currentStatus = pick(form, "current_status", STATUS);
  const pathTaken = pick(form, "path_taken", PATHS);
  const consented = form.get("consent") != null;

  if (!currentStatus || !pathTaken) {
    return { status: "error", message: "Please answer your current status and what you did." };
  }
  if (!consented) {
    return { status: "error", message: "Please confirm consent to share your anonymized information." };
  }

  const stage = pick(form, "green_card_stage", STAGE);
  const lastWorkingDay = parseDate(field(form, "last_working_day"));
  const filedDate = parseDate(field(form, "filed_date"));
  const decisionDate = parseDate(field(form, "decision_date"));
  const notes = field(form, "notes");

  const row = {
    current_status: currentStatus,
    green_card_stage: stage,
    i140_status: i140From(stage),
    category: pick(form, "category", CATEGORIES),
    nationality_bucket: pick(form, "nationality_bucket", NATIONS),
    trigger: pick(form, "trigger", TRIGGERS),
    path_taken: pathTaken,
    outcome: pick(form, "outcome", OUTCOMES),
    got_rfe: checkbox(form, "got_rfe"),
    got_noid: checkbox(form, "got_noid"),
    premium_processing: checkbox(form, "premium_processing"),
    time_to_file_days: sanitizeDelta(diffDays(filedDate, lastWorkingDay), -60, 400),
    time_to_decision_days: sanitizeDelta(diffDays(decisionDate, filedDate), 0, 1000),
    notes,
    case_date: isoDate(
      [lastWorkingDay, filedDate, decisionDate].filter(Boolean).sort((x, y) => (y as Date).getTime() - (x as Date).getTime())[0] ?? null
    ),
    source: "consented",
    verification: "self_reported",
    moderation_status: "approved",
    consented_at: new Date().toISOString()
  };

  let contributorUserId: string | null = null;
  try {
    const server = await createSupabaseServerClient();
    const {
      data: { user }
    } = await server.auth.getUser();
    contributorUserId = user?.id ?? null;
  } catch {
    contributorUserId = null;
  }

  const admin = createSupabaseAdminClient() as any;

  // 1) The queryable structured data point.
  const { error: insertError } = await admin
    .from("community_case_data_points")
    .insert({ ...row, contributor_user_id: contributorUserId });
  if (insertError) {
    return { status: "error", message: "Something went wrong saving your case. Please try again." };
  }

  // 2) Unified-intake audit record (raw payload + provenance).
  await admin.from("community_import_items").insert({
    source: "user_form",
    source_type: "user_form",
    source_story_id: crypto.randomUUID(),
    source_payload_private: row as unknown as Json,
    publish_draft: {} as Json,
    moderation_status: "approved",
    consent_at: row.consented_at,
    contributor_user_id: contributorUserId
  });

  return {
    status: "success",
    message: "Thank you — your anonymized case was added. Once enough people like you share, you'll see what they did."
  };
}
