import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getLawFirm, getLawFirms } from "@/lib/legal-directory";
import type { ClaimProfile, FirmEvidence, LawFirm } from "@/components/app/legal-directory";

type ClaimRow = {
  claim_type: string;
  firm_id: string | null;
  firm_name: string;
  claimant_phone: string | null;
  evidence_bar_url: string | null;
  evidence_aila_url: string | null;
  evidence_specialist_url: string | null;
  evidence_website: string | null;
  profile: Record<string, unknown> | null;
  updated_at: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function asProfile(raw: Record<string, unknown> | null): ClaimProfile {
  return (raw ?? {}) as ClaimProfile;
}

function evidenceFrom(row: ClaimRow): FirmEvidence {
  return {
    barUrl: row.evidence_bar_url,
    ailaUrl: row.evidence_aila_url,
    specialistUrl: row.evidence_specialist_url,
    website: row.evidence_website
  };
}

function uniq(values: Array<string | undefined | null>) {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

// Overlay a published claim onto the firm's static Places record. Keeps the
// objective Places data; layers firm-provided details + unions the filterable
// fields (languages, practice) so claimed info is discoverable.
function applyClaim(firm: LawFirm, row: ClaimRow): LawFirm {
  const profile = asProfile(row.profile);
  return {
    ...firm,
    claimStatus: "claimed",
    claimedAt: row.updated_at,
    evidence: evidenceFrom(row),
    claimProfile: profile,
    languagesSpoken: uniq([...firm.languagesSpoken, ...(profile.languages ?? [])]),
    practiceFocus: uniq([...firm.practiceFocus, ...(profile.visaTypes ?? [])])
  };
}

// Build a brand-new card from an 'apply' row (firm not in the Places base).
function firmFromApplication(row: ClaimRow): LawFirm {
  const profile = asProfile(row.profile);
  const state = (profile as { state?: string }).state ?? "";
  const city = (profile as { city?: string }).city ?? "";
  return {
    id: `listed-${slugify(row.firm_name)}`,
    firmName: row.firm_name,
    trustScore: 50,
    metro: city ? `${city}, ${state}` : state,
    city,
    state,
    website: row.evidence_website ?? "",
    phone: row.claimant_phone,
    practiceFocus: uniq(profile.visaTypes ?? ["Immigration"]),
    languagesSpoken: uniq(["English", ...(profile.languages ?? [])]),
    firmSizeBucket: "2-5",
    sizeConfidence: "low",
    barVerified: null,
    ailaMember: false,
    rating: null,
    reviewCount: null,
    verifiedAsOf: row.updated_at.slice(0, 10),
    sources: [],
    claimStatus: "claimed",
    claimedAt: row.updated_at,
    evidence: evidenceFrom(row),
    claimProfile: profile
  };
}

async function fetchClaimedRows(): Promise<ClaimRow[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("legal_firm_claims")
    .select(
      "claim_type, firm_id, firm_name, claimant_phone, evidence_bar_url, evidence_aila_url, evidence_specialist_url, evidence_website, profile, updated_at"
    )
    .eq("status", "claimed")
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data as ClaimRow[];
}

// All directory firms = static Places base (with claims overlaid) + published
// 'apply' firms. Newest claim wins if a firm somehow has multiple.
export async function getMergedFirms(): Promise<LawFirm[]> {
  const rows = await fetchClaimedRows();
  const claimByFirmId = new Map<string, ClaimRow>();
  const applied: LawFirm[] = [];

  for (const row of rows) {
    if (row.claim_type === "claim" && row.firm_id) {
      if (!claimByFirmId.has(row.firm_id)) claimByFirmId.set(row.firm_id, row);
    } else if (row.claim_type === "apply") {
      applied.push(firmFromApplication(row));
    }
  }

  const base = getLawFirms().map((firm) => {
    const row = claimByFirmId.get(firm.id);
    return row ? applyClaim(firm, row) : { ...firm, claimStatus: "unclaimed" as const };
  });

  return [...base, ...applied];
}

// Resolve one firm by id for the detail page (base+claim, or an applied firm).
export async function getMergedFirm(id: string): Promise<LawFirm | undefined> {
  const base = getLawFirm(id);
  if (base) {
    const rows = await fetchClaimedRows();
    const row = rows.find((r) => r.claim_type === "claim" && r.firm_id === id);
    return row ? applyClaim(base, row) : { ...base, claimStatus: "unclaimed" };
  }
  const rows = await fetchClaimedRows();
  return rows
    .filter((r) => r.claim_type === "apply")
    .map(firmFromApplication)
    .find((firm) => firm.id === id);
}
