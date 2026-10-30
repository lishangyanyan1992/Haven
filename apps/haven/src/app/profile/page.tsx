import Link from "next/link";
import { HELP_NEEDED_OPTIONS, HELP_NEEDED_SENT_MARKER } from "@/lib/firms/help-needed";
import { AlertTriangle, CheckCircle2, FileWarning } from "lucide-react";

import { ALL_VISA_OPTIONS } from "@/lib/visas";
import { AppShell } from "@/components/app/app-shell";
import { GreenCardEditor } from "@/components/app/green-card-editor";
import { CaseMemoryCard, type DocumentExtractedFactSummary } from "@/components/app/case-memory-card";
import { FieldSourceLabel } from "@/components/app/field-source-label";
import { formatSourceValue } from "@/lib/field-sources/format";
import { loadFieldSources } from "@/lib/field-sources/db";
import type { FieldSource } from "@/lib/field-sources/plan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { loadDeadlineAnswers } from "@/lib/deadlines";
import { hasSupabaseEnv } from "@/lib/env";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getAppShellSnapshot } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";
import { saveProfileSettingsAction } from "@/server/actions";
import { seedPetitionsFromLegacyProfile } from "@/lib/petitions";
import { listFacts } from "@/lib/advisor/memory";
import { loadFactsByDocument } from "@/lib/document-facts/run";
import { describeFacts } from "@/lib/document-facts/describe";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  ...noIndexMetadata,
  title: "Your Info · Haven"
};

export default async function ProfileInfoPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [snapshot, crisisState] = await Promise.all([
    getAppShellSnapshot(),
    getCrisisState()
  ]);
  const { profile } = snapshot;

  // Load deadline answers and field sources
  const savedDeadlines = profile.id && hasSupabaseEnv ? await loadDeadlineAnswers(profile.id) : undefined;
  const sources: Record<string, FieldSource> =
    profile.id && hasSupabaseEnv ? Object.fromEntries(await loadFieldSources(profile.id)) : {};
  const statusEndDate = savedDeadlines?.statusEndDate ?? profile.currentVisaExpiryDate ?? null;
  const countryOptions = ["India", "China", "Mexico", "Philippines", "South Korea", "Brazil", "Canada", "United Kingdom", "Other"];
  if (profile.countryOfBirth && !countryOptions.includes(profile.countryOfBirth)) {
    countryOptions.unshift(profile.countryOfBirth);
  }

  // Pre-seed petitions from legacy flat fields if no petitions array
  const initialPetitions = seedPetitionsFromLegacyProfile(profile);

  // Load remembered facts and document-extracted facts
  let rememberedFacts: Awaited<ReturnType<typeof listFacts>> = [];
  const documentFactSummaries: DocumentExtractedFactSummary[] = [];

  if (profile.id && hasSupabaseEnv) {
    try {
      const [facts, factsByDoc] = await Promise.all([
        listFacts(profile.id),
        loadFactsByDocument(profile.id)
      ]);
      rememberedFacts = facts;

      if (factsByDoc.size > 0) {
        const supabase = await createSupabaseServerClient();
        const { data: userDocs } = await (supabase as any)
          .from("user_documents")
          .select("id, original_filename, document_kind")
          .eq("user_id", profile.id);

        const docMap = new Map<string, string>();
        for (const d of userDocs ?? []) {
          docMap.set(d.id, d.original_filename || d.document_kind || "Document");
        }

        const sponsorNames = new Map(initialPetitions.map((p) => [p.id, p.sponsorName]));
        for (const [docId, factsList] of factsByDoc.entries()) {
          const { lines } = describeFacts(factsList, sponsorNames, sources);
          if (lines.length > 0) {
            documentFactSummaries.push({
              documentId: docId,
              documentName: docMap.get(docId) || "Uploaded Document",
              lines
            });
          }
        }
      }
    } catch (err) {
      console.error("[profile] failed to load memories or document facts:", err);
    }
  }

  const profileGaps: Array<{
    id: string;
    label: string;
    detail: string;
    severity: "critical" | "warning" | "info";
  }> = [];

  if (profile.spouseVisaStatus === "other") {
    profileGaps.push({
      id: "spouse-other",
      label: "Spouse / partner visa status is set to 'Other'",
      detail:
        "Update to US citizen, Green card holder, H-1B, H-4, or No spouse so Track 3 can evaluate immediate-relative I-130/I-485 adjustment vs. H-4 dependent backup status.",
      severity: "warning"
    });
  }

  const hasStartedGreenCardStage =
    (profile.permStage && profile.permStage !== "not_started") ||
    Boolean(profile.i140Filed) ||
    Boolean(profile.i140Approved) ||
    Boolean(profile.i485Filed) ||
    Boolean(profile.priorityDate) ||
    initialPetitions.length > 0;

  const hasPetitionRecords = initialPetitions.length > 0;
  if (!profile.greenCardSponsor && !profile.retainedPriorityDateSponsor && !hasPetitionRecords && hasStartedGreenCardStage) {
    profileGaps.push({
      id: "gc-sponsor-attribution",
      label: "Green card sponsor not confirmed",
      detail: `Never assume your green card is tied to your current employer (${profile.employerName ?? "Current"}). Enter the sponsoring employer or self-petition entity below to clarify priority date retention and portability.`,
      severity: "warning"
    });
  }

  if (profile.i140Approved && profile.permStage === "not_started" && initialPetitions.length <= 1) {
    profileGaps.push({
      id: "multi-employer-perm-gap",
      label: "Approved I-140 from prior sponsor vs. new employer PERM not started",
      detail: `Your profile shows an approved ${profile.preferenceCategory} I-140 (PD ${profile.priorityDate ?? "on file"}), while PERM at ${profile.employerName ?? "your latest sponsor"} was not completed. Your next sponsor must start a fresh PERM/I-140 to recapture your priority date.`,
      severity: "warning"
    });
  }

  if (savedDeadlines?.agencyDeadlineType === "interview" && !profile.i485Filed) {
    profileGaps.push({
      id: "interview-without-i485",
      label: `Agency 'Interview' (${savedDeadlines.agencyDeadlineDate ?? "unscheduled"}) conflicts with I-485 not filed`,
      detail:
        "If this interview is a consular visa stamping appointment or a marriage-based I-485 interview, clarify in Urgent Deadlines (/onboarding?step=5) or update your Green Card stage.",
      severity: "critical"
    });
  }

  if (!profile.employerIndustry) {
    profileGaps.push({
      id: "employer-industry",
      label: "Employer industry not classified",
      detail:
        "Add your employer's industry so Haven can benchmark layoff readiness, prevailing wage tiers, and cap-exempt transfer eligibility.",
      severity: "info"
    });
  }

  return (
    <AppShell activePath="/profile" crisisState={crisisState} snapshot={snapshot}>
      <div className="space-y-6">
        <section className="page-intro">
          <p className="text-label">Your Information</p>
          <h1 className="text-h1 mt-4">Keep your case record and memory current.</h1>
          <p className="text-body mt-4 max-w-[65ch]">
            These details shape your dashboard recommendations, timeline, layoff options, advisor answers, and what your connected lawyer sees.
          </p>
        </section>

        {resolvedSearchParams?.saved === "1" && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-5 py-4 text-body-sm">
            Your information has been updated. Haven is now using these details across the app.
          </div>
        )}

        <section className="rounded-[var(--radius-xl)] border border-[#E5C9A8] bg-[#FDF8F1] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-warning)]" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8F4E10]">
                    Intake & Profile Completeness Audit
                  </p>
                  <Badge variant={profileGaps.length > 0 ? "pending" : "active"}>
                    {profileGaps.length} item{profileGaps.length === 1 ? "" : "s"} flagged
                  </Badge>
                </div>
                <h2 className="mt-1 text-[16px] font-semibold text-[var(--haven-ink)]">
                  How your intake answers and urgent deadlines wire into the product
                </h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                  Status end date:{" "}
                  <strong className="text-[var(--haven-ink)]">
                    {profile.currentVisaExpiryDate ?? savedDeadlines?.statusEndDate ?? "Not set"}
                  </strong>{" "}
                  · Last day of work:{" "}
                  <strong className="text-[var(--haven-ink)]">
                    {savedDeadlines?.lastWorkDay ?? "Not set"}
                  </strong>{" "}
                  · Agency deadline:{" "}
                  <strong className="text-[var(--haven-ink)]">
                    {savedDeadlines?.agencyDeadlineType
                      ? `${savedDeadlines.agencyDeadlineType.toUpperCase()} (${savedDeadlines.agencyDeadlineDate ?? "TBD"})`
                      : "None"}
                  </strong>{" "}
                  · Travel planned:{" "}
                  <strong className="text-[var(--haven-ink)]">
                    {savedDeadlines?.travelPlanned === "yes" ? savedDeadlines.travelDate ?? "Yes" : "No"}
                  </strong>
                </p>
              </div>
            </div>
            <Link
              className="inline-flex items-center rounded-full border border-[#D9B890] bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[#8F4E10] hover:bg-[#FAF1E4]"
              href="/onboarding?step=5"
            >
              Edit urgent deadlines →
            </Link>
          </div>

          {profileGaps.length > 0 && (
            <div className="mt-4 grid gap-2.5 md:grid-cols-2">
              {profileGaps.map((gap) => (
                <div
                  className="rounded-[var(--radius-lg)] border border-[#E5C9A8] bg-white px-3.5 py-3"
                  key={gap.id}
                >
                  <div className="flex items-center gap-2">
                    {gap.severity === "critical" ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-danger)]" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-warning)]" />
                    )}
                    <p className="text-[12.5px] font-semibold text-[var(--haven-ink)]">{gap.label}</p>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-[var(--color-text-secondary)]">{gap.detail}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Current Visa, Employment & Situation */}
        <form action={saveProfileSettingsAction} className="space-y-6" id="case-details">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div>
                  <p className="text-label">Current Visa & Situation</p>
                  <CardTitle className="mt-2">Your active status & basic facts</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Current visa status">
                  <Select defaultValue={profile.visaType} name="visaType">
                    {(() => {
                      const standardValues = ALL_VISA_OPTIONS.map((opt) => opt.value);
                      const allOptions = standardValues.includes(profile.visaType)
                        ? ALL_VISA_OPTIONS
                        : [{ value: profile.visaType, label: profile.visaType, group: "Other" }, ...ALL_VISA_OPTIONS];
                      return allOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ));
                    })()}
                  </Select>
                  <FieldSourceLabel fieldKey="visaType" hasValue={Boolean(profile.visaType)} source={sources.visaType} />
                </Field>
                <Field label="Country of birth">
                  <Select defaultValue={profile.countryOfBirth} name="countryOfBirth">
                    {countryOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                  <FieldSourceLabel fieldKey="countryOfBirth" hasValue={Boolean(profile.countryOfBirth)} source={sources.countryOfBirth} />
                </Field>
                <Field label="Primary goal">
                  <Select defaultValue={profile.primaryGoal} name="primaryGoal">
                    <option value="get_gc">Get my green card</option>
                    <option value="job_stability">Stay stable at current employer</option>
                    <option value="explore_options">Explore all my options</option>
                    <option value="stay_flexible">Maximize flexibility</option>
                    <option value="not_sure">Not sure yet</option>
                  </Select>
                </Field>
                <Field label="Spouse or partner visa status">
                  <Select defaultValue={profile.spouseVisaStatus} name="spouseVisaStatus">
                    <option value="none">No spouse / not applicable</option>
                    <option value="H1B">Spouse on H1B</option>
                    <option value="H4">Spouse on H4</option>
                    <option value="H4 EAD">Spouse on H4 EAD</option>
                    <option value="GC">Spouse is a green card holder</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <p className="text-label">Employment</p>
                  <CardTitle className="mt-2">Context for dates, portability, and risk</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Employer name">
                  <Input defaultValue={profile.employerName ?? ""} name="employerName" placeholder="e.g. Nimbus AI" />
                  <FieldSourceLabel fieldKey="employerName" hasValue={Boolean(profile.employerName)} source={sources.employerName} />
                </Field>
                {statusEndDate || sources.statusEndDate ? (
                  <div>
                    <p className="field-label">Status end date</p>
                    <p className="text-body-sm text-[var(--haven-ink)]">
                      {formatSourceValue(statusEndDate)}{" "}
                      <Link className="text-[12px] underline underline-offset-2" href="/dashboard#journey-statusEndDate">
                        Change on your dashboard
                      </Link>
                    </p>
                    <FieldSourceLabel fieldKey="statusEndDate" hasValue={Boolean(statusEndDate)} source={sources.statusEndDate} />
                  </div>
                ) : null}
                <Field label="Job title">
                  <Input defaultValue={profile.jobTitle ?? ""} name="jobTitle" placeholder="e.g. Senior Software Engineer" />
                </Field>
                <Field label="H-1B start date">
                  <Input defaultValue={profile.h1bStartDate ?? ""} name="h1bStartDate" type="date" />
                </Field>
                <Field label="Employer size">
                  <Select defaultValue={profile.employerSize ?? "enterprise"} name="employerSize">
                    <option value="startup">Startup (under 200)</option>
                    <option value="mid-size">Mid-size (200–2,000)</option>
                    <option value="enterprise">Enterprise (2,000+)</option>
                  </Select>
                </Field>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div>
                <p className="text-label">Help needed</p>
                <CardTitle className="mt-2">What help do you need from your lawyer?</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-body-sm">
                Pick any that apply. Your lawyer sees these, and they also shape your dashboard guidance and community matching.
              </p>
              <input name={HELP_NEEDED_SENT_MARKER} type="hidden" value="1" />
              <div className="grid gap-3 md:grid-cols-2">
                {HELP_NEEDED_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-4"
                  >
                    <input
                      className="mt-1 h-4 w-4 accent-[var(--haven-sage)]"
                      defaultChecked={(profile.helpNeeded ?? []).includes(option.value)}
                      name="helpNeeded"
                      type="checkbox"
                      value={option.value}
                    />
                    <div>
                      <p className="text-h3">{option.label}</p>
                      <p className="text-body-sm mt-2">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button size="lg" type="submit">
              Save visa & employment changes
            </Button>
          </div>
        </form>

        {/* Unified Green Cards Editor */}
        <GreenCardEditor initialPetitions={initialPetitions} sources={sources} />

        {/* Permanent Case Memory & Extracted Facts */}
        <CaseMemoryCard
          initialFacts={rememberedFacts}
          documentFacts={documentFactSummaries}
          showDocumentFacts={true}
        />
      </div>
    </AppShell>
  );
}

function Field({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
