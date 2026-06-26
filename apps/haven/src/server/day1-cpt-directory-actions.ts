"use server";

import { revalidatePath } from "next/cache";
import { getDomain } from "tldts";

import { day1CptSchools } from "@/lib/day1-cpt-schools";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type Day1CptFeedbackActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const FEEDBACK_KINDS = ["school_comment", "consultant_listing"] as const;
const RELATIONSHIPS = ["student", "alum", "applicant", "school_staff", "consultant", "other"] as const;

const schoolById = new Map(day1CptSchools.map((school) => [school.id, school]));

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bounded(value: string | null, maxLength: number) {
  return value ? value.slice(0, maxLength) : null;
}

function pick<const T extends readonly string[]>(value: string | null, allowed: T): T[number] | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T[number]) : null;
}

function normalizeEmail(value: string | null) {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function safeUrl(raw: string | null): { url: string; domain: string | null } | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return { url: url.toString(), domain: getDomain(url.hostname) };
  } catch {
    return null;
  }
}

export async function submitDay1CptFeedback(
  _prev: Day1CptFeedbackActionState,
  form: FormData
): Promise<Day1CptFeedbackActionState> {
  const feedbackKind = pick(field(form, "feedback_kind"), FEEDBACK_KINDS);
  const relationship = pick(field(form, "relationship"), RELATIONSHIPS);
  const submitterEmail = normalizeEmail(field(form, "submitter_email"));
  const comment = bounded(field(form, "comment"), 3000);

  if (!feedbackKind) {
    return { status: "error", message: "Choose what you want to share." };
  }

  if (!comment || comment.length < 12) {
    return { status: "error", message: "Add a short note so we have enough context to review." };
  }

  let schoolId: string | null = null;
  let schoolName: string | null = null;
  let organizationName: string | null = null;
  let organizationWebsite: string | null = null;
  let organizationDomain: string | null = null;
  let services: string | null = null;

  if (feedbackKind === "school_comment") {
    schoolId = bounded(field(form, "school_id"), 140);
    const school = schoolId ? schoolById.get(schoolId) : null;
    if (!school) {
      return { status: "error", message: "Choose a listed school before adding a note." };
    }
    schoolName = school.name;
  }

  if (feedbackKind === "consultant_listing") {
    organizationName = bounded(field(form, "organization_name"), 180);
    const parsedWebsite = safeUrl(bounded(field(form, "organization_website"), 2048));
    services = bounded(field(form, "services"), 1000);

    if (!organizationName) {
      return { status: "error", message: "Add your consultancy or organization name." };
    }

    if (!submitterEmail) {
      return { status: "error", message: "Add a valid email so we can contact you." };
    }

    if (!parsedWebsite) {
      return { status: "error", message: "Add a valid website URL so applicants can verify your organization." };
    }

    if (!services || services.length < 12) {
      return { status: "error", message: "Briefly describe the Day 1 CPT services you provide." };
    }

    organizationWebsite = parsedWebsite.url;
    organizationDomain = parsedWebsite.domain;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await (admin as any).from("day1_cpt_directory_feedback").insert({
    feedback_kind: feedbackKind,
    school_id: schoolId,
    school_name: schoolName,
    organization_name: organizationName,
    organization_website: organizationWebsite,
    organization_domain: organizationDomain,
    services,
    relationship: relationship ?? (feedbackKind === "consultant_listing" ? "consultant" : "student"),
    submitter_email: submitterEmail,
    comment,
    moderation_status: "pending"
  });

  if (error) {
    return { status: "error", message: "Could not save this right now. Please try again." };
  }

  revalidatePath("/day-1-cpt-schools");

  return {
    status: "success",
    message:
      feedbackKind === "consultant_listing"
        ? "Thanks. We received your listing request and will review it before publishing anything."
        : "Thanks. We received your note and will review it before it appears publicly."
  };
}

