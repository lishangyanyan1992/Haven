import type { Metadata } from "next";
import Link from "next/link";

import { CaseOutcomesCard } from "@/components/app/case-outcomes-card";
import { getCaseOutcomeStats, type CaseSegmentFilters } from "@/lib/advisor/case-stats";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "What people like you did — Haven Community",
  description:
    "See anonymized, aggregated outcomes from Haven users in your situation — what paths people took after an H-1B layoff and how they turned out.",
  alternates: { canonical: "/community/insights" },
  openGraph: { url: absoluteUrl("/community/insights") }
};

const STATUS = ["h1b", "f1_opt", "l1", "other"];
const NATIONS = ["india", "china", "row"];
const CATEGORIES = ["eb1", "eb2", "eb3"];
const TRIGGERS = ["laid_off", "quit", "opt_ending", "other"];
const I140 = ["none", "pending", "approved"];

function within(value: string | undefined, allowed: string[]): string | null {
  return value && allowed.includes(value) ? value : null;
}
function mapVisa(visaType: string | null): string {
  const v = (visaType ?? "").toUpperCase();
  if (v === "H1B") return "h1b";
  if (v === "OPT" || v === "STEM OPT") return "f1_opt";
  return "other";
}
function bucketNation(country: string | null): string | null {
  const c = (country ?? "").trim().toLowerCase();
  if (!c) return null;
  if (c.includes("india")) return "india";
  if (c.includes("china")) return "china";
  return "row";
}
function mapCategory(pref: string | null): string | null {
  const p = (pref ?? "").toUpperCase();
  if (p.includes("EB-1")) return "eb1";
  if (p.includes("EB-2")) return "eb2";
  if (p.includes("EB-3")) return "eb3";
  return null;
}

async function resolveFilters(
  sp: Record<string, string | string[] | undefined>
): Promise<{ filters: CaseSegmentFilters; personalized: boolean }> {
  const q = (key: string) => (Array.isArray(sp[key]) ? sp[key]?.[0] : sp[key]) as string | undefined;

  // Explicit query-param filters take precedence (lets anyone explore a segment).
  const explicit: CaseSegmentFilters = {
    currentStatus: within(q("status"), STATUS),
    i140Status: within(q("i140"), I140),
    nationalityBucket: within(q("nationality"), NATIONS),
    category: within(q("category"), CATEGORIES),
    trigger: within(q("trigger"), TRIGGERS)
  };
  if (Object.values(explicit).some(Boolean)) {
    return { filters: explicit, personalized: false };
  }

  // Otherwise personalize from the logged-in user's profile.
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await (supabase as any)
        .from("user_profiles")
        .select("visa_type, country_of_birth, i140_approved, preference_category")
        .eq("id", user.id)
        .maybeSingle();
      if (profile) {
        return {
          filters: {
            currentStatus: mapVisa(profile.visa_type),
            i140Status: profile.i140_approved ? "approved" : null,
            nationalityBucket: bucketNation(profile.country_of_birth),
            category: mapCategory(profile.preference_category),
            trigger: "laid_off"
          },
          personalized: true
        };
      }
    }
  } catch {
    // fall through to empty filters
  }

  return { filters: { trigger: "laid_off" }, personalized: false };
}

export default async function CommunityInsightsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { filters, personalized } = await resolveFilters(sp);
  const block = await getCaseOutcomeStats(filters);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-16">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">People like you</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Anonymized, aggregated outcomes from Haven users who faced a similar situation — what they did and
          how it turned out. {personalized ? "Personalized from your profile." : "Showing a general segment."}
        </p>
      </header>

      <CaseOutcomesCard block={block} />

      <p className="mt-6 text-xs text-[var(--color-text-tertiary)]">
        Haven shows what others did, not a recommendation.{" "}
        <Link href="/community/contribute" className="text-[var(--haven-sage)] hover:underline">
          Share your own path
        </Link>{" "}
        to make this more accurate for the next person.
      </p>
    </main>
  );
}
