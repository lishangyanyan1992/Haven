"use server";

import { revalidatePath } from "next/cache";
import { getDomain } from "tldts";

import lawFirmDirectoryData from "@/data/law-firm-directory.json";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type LegalFeedbackActionState = {
  status: "idle" | "success" | "error";
  message: string;
  // Present when a new-firm suggestion was blocked because its root domain
  // matches a firm already in the directory. The UI links to that record so
  // the user can leave a comment there instead.
  existingFirm?: { id: string; name: string };
};

const FEEDBACK_KINDS = ["firm_comment", "new_firm"] as const;
const RELATIONSHIPS = ["client", "prospective_client", "attorney", "referral", "other"] as const;

type DirectoryFirm = {
  id: string;
  firmName: string;
  website?: string;
};

// Root domain (eTLD+1) -> one existing firm, built once at module load from the
// same JSON the /lawyers page renders. Keep-first so the first listed firm for a
// shared domain is the one named in the duplicate message.
const existingFirmByDomain = new Map<string, { id: string; name: string }>();
for (const firm of (lawFirmDirectoryData as { firms: DirectoryFirm[] }).firms) {
  if (!firm.website) continue;
  const domain = getDomain(firm.website);
  if (!domain) continue;
  if (!existingFirmByDomain.has(domain)) {
    existingFirmByDomain.set(domain, { id: firm.id, name: firm.firmName });
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
  return value && allowed.includes(value) ? (value as T[number]) : null;
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

export async function submitLegalFeedback(
  _prev: LegalFeedbackActionState,
  form: FormData
): Promise<LegalFeedbackActionState> {
  const feedbackKind = pick(field(form, "feedback_kind"), FEEDBACK_KINDS);
  const relationship = pick(field(form, "relationship"), RELATIONSHIPS);
  const firmId = bounded(field(form, "firm_id"), 140);
  const firmName = bounded(field(form, "firm_name"), 180);
  const comment = bounded(field(form, "comment"), 2000);
  const submitterEmail = normalizeEmail(field(form, "submitter_email"));

  if (!feedbackKind) {
    return { status: "error", message: "Choose what you want to share." };
  }

  if (!firmName) {
    return { status: "error", message: "Add the firm name." };
  }

  if (!comment || comment.length < 12) {
    return { status: "error", message: "Add a short note so other people understand the context." };
  }

  if (feedbackKind === "firm_comment" && !firmId) {
    return { status: "error", message: "Choose a listed firm before adding a note." };
  }

  // New-firm suggestions must include a website, and its root domain must not
  // match a firm already listed — otherwise the user should comment on the
  // existing record instead of creating a duplicate.
  let firmWebsite: string | null = null;
  let firmDomain: string | null = null;
  if (feedbackKind === "new_firm") {
    const parsed = parseWebsiteUrl(bounded(field(form, "firm_website"), 2048));
    if (!parsed) {
      return {
        status: "error",
        message: "Add a valid firm website URL so we can check it is not already listed."
      };
    }
    const existing = existingFirmByDomain.get(parsed.domain);
    if (existing) {
      return {
        status: "error",
        message: `This looks like ${existing.name}, which is already in the directory. Leave a comment on that firm's record instead.`,
        existingFirm: existing
      };
    }
    firmWebsite = parsed.url.toString();
    firmDomain = parsed.domain;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("legal_directory_feedback").insert({
    firm_id: feedbackKind === "firm_comment" ? firmId : null,
    firm_name: firmName,
    comment,
    firm_domain: firmDomain,
    firm_website: firmWebsite,
    feedback_kind: feedbackKind,
    moderation_status: "pending",
    relationship: relationship ?? "client",
    submitter_email: submitterEmail
  });

  if (error) {
    return { status: "error", message: "Could not save this note right now. Please try again." };
  }

  revalidatePath("/lawyers");

  return {
    status: "success",
    message:
      feedbackKind === "new_firm"
        ? "Thanks. We received this firm suggestion and will verify it before adding it."
        : "Thanks. We received your note and will review it before it appears publicly."
  };
}
