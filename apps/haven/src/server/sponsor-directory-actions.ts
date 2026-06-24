"use server";

import { revalidatePath } from "next/cache";
import { getDomain } from "tldts";

import sponsorDirectoryData from "@/data/sponsor-directory.json";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type SponsorFeedbackActionState = {
  status: "idle" | "success" | "error";
  message: string;
  // Present when a new-company suggestion was blocked because its root domain
  // matches a company already in the directory. The UI links to that record so
  // the user can leave a comment there instead.
  existingCompany?: { id: string; name: string };
};

const FEEDBACK_KINDS = ["company_comment", "new_company"] as const;
const RELATIONSHIPS = ["candidate", "employee", "former_employee", "recruiter", "immigration_team", "other"] as const;

type DirectoryCompany = {
  id: string;
  companyName: string;
  website?: string;
};

// Root domain (eTLD+1) -> one existing company, built once at module load from the
// same JSON the /jobs page renders. Keep-first so the primary, most-recognizable
// entity for a shared brand (e.g. "Amazon.com Services LLC" for amazon.com) is the
// one named in the duplicate message. Distinct legal entities that share a brand
// domain map to the same key on purpose — that shared root is the dedup signal.
const existingCompanyByDomain = new Map<string, { id: string; name: string }>();
for (const company of (sponsorDirectoryData as { companies: DirectoryCompany[] }).companies) {
  if (!company.website) continue;
  const domain = getDomain(company.website);
  if (!domain) continue;
  if (!existingCompanyByDomain.has(domain)) {
    existingCompanyByDomain.set(domain, { id: company.id, name: company.companyName });
  }
}

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

// Parse a submitted website URL and return its registrable root domain.
// Rejects non-http(s) schemes and anything tldts can't reduce to a root domain.
function parseWebsiteUrl(raw: string | null): { url: URL; domain: string } | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const domain = getDomain(url.hostname);
  return domain ? { url, domain } : null;
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

  // New-company suggestions must include a website, and its root domain must not
  // match a company already listed — otherwise the user should comment on the
  // existing record instead of creating a duplicate.
  let companyWebsite: string | null = null;
  let companyDomain: string | null = null;
  if (feedbackKind === "new_company") {
    const parsed = parseWebsiteUrl(bounded(field(form, "company_website"), 2048));
    if (!parsed) {
      return {
        status: "error",
        message: "Add a valid company website URL so we can check it is not already listed."
      };
    }
    const existing = existingCompanyByDomain.get(parsed.domain);
    if (existing) {
      return {
        status: "error",
        message: `This looks like ${existing.name}, which is already in the directory. Leave a comment on that company's record instead.`,
        existingCompany: existing
      };
    }
    companyWebsite = parsed.url.toString();
    companyDomain = parsed.domain;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("sponsor_directory_feedback").insert({
    company_id: feedbackKind === "company_comment" ? companyId : null,
    company_name: companyName,
    comment,
    company_domain: companyDomain,
    company_website: companyWebsite,
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