"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SponsorFeedbackActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const FEEDBACK_KINDS = ["company_comment", "new_company"] as const;
const RELATIONSHIPS = ["candidate", "employee", "former_employee", "recruiter", "immigration_team", "other"] as const;

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bounded(value: string | null, maxLength: number) {
  return value ? value.slice(0, maxLength) : null;
}

function pick<const T extends readonly string[]>(value: string | null, allowed: T): T[number] | null {
  return value && allowed.includes(value) ? value as T[number] : null;
}

function normalizeEmail(value: string | null) {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export async function submitSponsorFeedback(
  _prev: SponsorFeedbackActionState,
  form: FormData
): Promise<SponsorFeedbackActionState> {
  const feedbackKind = pick(field(form, "feedback_kind"), FEEDBACK_KINDS);
  const relationship = pick(field(form, "relationship"), RELATIONSHIPS);
  const companyId = bounded(field(form, "company_id"), 140);
  const companyName = bounded(field(form, "company_name"), 180);
  const comment = bounded(field(form, "comment"), 2000);
  const submitterEmail = normalizeEmail(field(form, "submitter_email"));

  if (!feedbackKind) {
    return { status: "error", message: "Choose what you want to share." };
  }

  if (!companyName) {
    return { status: "error", message: "Add the company name." };
  }

  if (!comment || comment.length < 12) {
    return { status: "error", message: "Add a short note so other people understand the context." };
  }

  if (feedbackKind === "company_comment" && !companyId) {
    return { status: "error", message: "Choose a listed company before adding a note." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("sponsor_directory_feedback").insert({
    company_id: feedbackKind === "company_comment" ? companyId : null,
    company_name: companyName,
    comment,
    feedback_kind: feedbackKind,
    moderation_status: "pending",
    relationship: relationship ?? "candidate",
    submitter_email: submitterEmail
  });

  if (error) {
    return { status: "error", message: "Could not save this note right now. Please try again." };
  }

  revalidatePath("/jobs");

  return {
    status: "success",
    message:
      feedbackKind === "new_company"
        ? "Thanks. We received this company suggestion and will review it before adding it."
        : "Thanks. We received your company note and will review it before it appears publicly."
  };
}
