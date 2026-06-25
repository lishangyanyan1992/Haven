"use server";

import { revalidatePath } from "next/cache";
import { getDomain } from "tldts";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getLawFirm } from "@/lib/legal-directory";
import {
  CONSULTATION_TYPES,
  HARD_CASES,
  LANGUAGES,
  PRICING_STRUCTURES,
  US_STATES,
  VISA_TYPES
} from "@/lib/legal-claim-options";

export type FirmClaimActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const CLAIM_TYPES = ["claim", "apply"] as const;

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function bounded(value: string | null, maxLength: number) {
  return value ? value.slice(0, maxLength) : null;
}

function checkbox(form: FormData, name: string) {
  return form.get(name) != null;
}

function pick<const T extends readonly string[]>(value: string | null, allowed: T): T[number] | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T[number]) : null;
}

// Keep only submitted values that are in the canonical option list (max 20).
function multi(form: FormData, name: string, allowed: readonly string[]) {
  const set = new Set(allowed);
  return form
    .getAll(name)
    .filter((v): v is string => typeof v === "string" && set.has(v))
    .slice(0, 20);
}

function normalizeEmail(value: string | null) {
  if (!value) return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

// Validate an optional http(s) URL; return normalized string or null.
function safeUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function submitFirmClaim(
  _prev: FirmClaimActionState,
  form: FormData
): Promise<FirmClaimActionState> {
  const claimType = pick(field(form, "claim_type"), CLAIM_TYPES);
  const firmId = bounded(field(form, "firm_id"), 140);
  const firmName = bounded(field(form, "firm_name"), 180);
  const claimantEmail = normalizeEmail(field(form, "claimant_email"));
  const attested = checkbox(form, "attested");

  if (!claimType) return { status: "error", message: "Something went wrong. Please retry." };
  if (!firmName) return { status: "error", message: "Add the firm name." };
  if (!claimantEmail) return { status: "error", message: "Add a valid work email so we can reach you." };
  if (!attested) {
    return { status: "error", message: "Please confirm you're authorized to represent this firm." };
  }
  if (claimType === "claim" && !firmId) {
    return { status: "error", message: "Missing the firm being claimed. Please retry from the firm's page." };
  }

  const website = safeUrl(bounded(field(form, "evidence_website"), 2048));
  if (claimType === "apply" && !website) {
    return { status: "error", message: "Add your firm website so people can verify you." };
  }

  // Auto-record whether the work-email domain matches the firm's website domain —
  // a review hint for the one-click publish step (not a gate). For a claim, compare
  // against the firm's KNOWN listed website; for an application, the submitted one.
  const knownSite = claimType === "claim" && firmId ? getLawFirm(firmId)?.website ?? null : null;
  const emailDomain = getDomain(claimantEmail.split("@")[1] ?? "");
  const siteDomain = getDomain(knownSite ?? website ?? "");
  const emailDomainMatch = Boolean(emailDomain && siteDomain && emailDomain === siteDomain);

  const profile = {
    visaTypes: multi(form, "visa_types", VISA_TYPES),
    hardCases: multi(form, "hard_cases", HARD_CASES),
    languages: multi(form, "languages", LANGUAGES),
    pricingStructure: pick(field(form, "pricing_structure"), PRICING_STRUCTURES),
    consultation: pick(field(form, "consultation"), CONSULTATION_TYPES),
    consultationFee: bounded(field(form, "consultation_fee"), 60),
    feeRange: bounded(field(form, "fee_range"), 120),
    bookingUrl: safeUrl(bounded(field(form, "booking_url"), 2048)),
    virtualAvailability: checkbox(form, "virtual_availability"),
    ailaMember: checkbox(form, "aila_member"),
    certifiedSpecialist: checkbox(form, "certified_specialist"),
    certifiedSpecialistState: pick(field(form, "certified_specialist_state"), US_STATES),
    yearsInPractice: bounded(field(form, "years_in_practice"), 20),
    bio: bounded(field(form, "bio"), 1200),
    // Base fields used to render a NEW card for 'apply' firms.
    ...(claimType === "apply"
      ? {
          city: bounded(field(form, "city"), 80),
          state: pick(field(form, "state"), US_STATES)
        }
      : {})
  };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("legal_firm_claims").insert({
    claim_type: claimType,
    firm_id: claimType === "claim" ? firmId : null,
    firm_name: firmName,
    status: "pending",
    claimant_name: bounded(field(form, "claimant_name"), 120),
    claimant_role: bounded(field(form, "claimant_role"), 120),
    claimant_email: claimantEmail,
    claimant_phone: bounded(field(form, "claimant_phone"), 40),
    email_domain_match: emailDomainMatch,
    bar_number: bounded(field(form, "bar_number"), 40),
    bar_state: pick(field(form, "bar_state"), US_STATES),
    evidence_bar_url: safeUrl(bounded(field(form, "evidence_bar_url"), 2048)),
    evidence_aila_url: safeUrl(bounded(field(form, "evidence_aila_url"), 2048)),
    evidence_specialist_url: safeUrl(bounded(field(form, "evidence_specialist_url"), 2048)),
    evidence_website: website,
    profile,
    attested
  });

  if (error) {
    return { status: "error", message: "Could not submit right now. Please try again." };
  }

  if (firmId) revalidatePath(`/lawyers/${firmId}`);
  revalidatePath("/lawyers");

  return {
    status: "success",
    message:
      claimType === "apply"
        ? "Thanks! We received your listing request and will review it shortly. Listing is always free."
        : "Thanks! We received your claim. Once we publish it, your firm details will appear on your listing."
  };
}
