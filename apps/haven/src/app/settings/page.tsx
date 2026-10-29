import Link from "next/link";
import { HELP_NEEDED_OPTIONS, HELP_NEEDED_SENT_MARKER } from "@/lib/firms/help-needed";
import { AlertTriangle, CheckCircle2, FileWarning } from "lucide-react";

import { ALL_PREFERENCE_CATEGORIES, chosenGreenCardStage } from "@/lib/visas";
import { AppShell } from "@/components/app/app-shell";
import { GreenCardEditor } from "@/components/app/green-card-editor";
import { FieldSourceLabel } from "@/components/app/field-source-label";
import { VisaStatusField } from "@/components/app/visa-status-field";
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

export const metadata = noIndexMetadata;

function inferGreenCardStage(profile: Awaited<ReturnType<typeof getAppShellSnapshot>>["profile"]) {
  if (profile.i485Filed) return "i485_filed";
  if (profile.i140Approved) return "i140_approved";
  if (profile.i140Filed) return "i140_filed";
  if (profile.permStage === "certified") return "perm_certified";
  if (profile.permStage === "in_progress") return "perm_in_progress";
  return "not_started";
}

export default async function SettingsPage({
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
  // No database means a local test persona: there are no saved deadlines to load.
  const savedDeadlines = profile.id && hasSupabaseEnv ? await loadDeadlineAnswers(profile.id) : undefined;
  // The step chosen here is kept as chosen, so family and other steps show up again.
  const greenCardStage = chosenGreenCardStage(profile.greenCardStage, inferGreenCardStage(profile));
  // Where each value came from (a document, or the person). None for a local test persona.
  const sources: Record<string, FieldSource> =
    profile.id && hasSupabaseEnv ? Object.fromEntries(await loadFieldSources(profile.id)) : {};
  const statusEndDate = savedDeadlines?.statusEndDate ?? profile.currentVisaExpiryDate ?? null;
  const countryOptions = ["India", "China", "Mexico", "Philippines", "South Korea", "Brazil", "Canada", "United Kingdom", "Other"];
  // A country read from a passport may not be in the short list; keep it selectable so saving doesn't change it.
  if (profile.countryOfBirth && !countryOptions.includes(profile.countryOfBirth)) countryOptions.unshift(profile.countryOfBirth);

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
    Boolean(profile.priorityDate);

  // Green card records name their own sponsors, so only ask when there are none.
  const hasPetitionRecords = (profile.immigrantPetitions?.length ?? 0) > 0;
  if (!profile.greenCardSponsor && !profile.retainedPriorityDateSponsor && !hasPetitionRecords && hasStartedGreenCardStage) {
    profileGaps.push({
      id: "gc-sponsor-attribution",
      label: "Green card sponsor not confirmed",
      detail: `Never assume your green card is tied to your current employer (${profile.employerName ?? "Current"}). Enter the sponsoring employer or self-petition entity below to clarify priority date retention and portability.`,
      severity: "warning"
    });
  }

  if (profile.i140Approved && profile.permStage === "not_started") {
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
    <AppShell activePath="/settings" crisisState={crisisState} snapshot={snapshot}>
      <div className="space-y-6">
        <section className="page-intro">
          <p className="text-label">Profile settings</p>
          <h1 className="text-h1 mt-4">Keep your Haven profile current.</h1>
          <p className="text-body mt-4 max-w-[65ch]">
            These details shape your dashboard recommendations, timeline, layoff planner, and community matching.
          </p>
        </section>

        {resolvedSearchParams?.saved === "1" && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-5 py-4 text-body-sm">
            Profile and email settings updated. Haven is now using the information below across the app.
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

        <form action={saveProfileSettingsAction} className="space-y-6" id="case-details">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div>
                  <p className="text-label">Immigration profile</p>
                  <CardTitle className="mt-2">The basics Haven uses everywhere</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Current visa status">
                  <VisaStatusField
                    // Remount when the saved value changes (e.g. "Use the document's value"), so a later save can't undo it.
                    key={`${profile.visaType}|${profile.customVisaDetail ?? ""}`}
                    defaultCustom={profile.customVisaDetail}
                    defaultValue={profile.visaType}
                  />
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

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div>
                  <p className="text-label">Green card journey</p>
                  <CardTitle className="mt-2">The details that shape the long view</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Green card stage">
                  <Select defaultValue={greenCardStage} name="greenCardStage">
                    <option value="not_started">Not started yet</option>
                    <option value="pwd_recruitment">Prevailing Wage / Recruitment</option>
                    <option value="perm_in_progress">PERM in progress</option>
                    <option value="perm_certified">PERM certified</option>
                    <option value="i140_filed">I-140 filed</option>
                    <option value="i140_approved">I-140 approved</option>
                    <option value="i130_filed">I-130 filed (Family / Marriage)</option>
                    <option value="i130_approved">I-130 approved</option>
                    <option value="consular_processing">Consular / NVC processing</option>
                    <option value="i485_filed">I-485 filed (Adjustment of status)</option>
                    <option value="conditional_resident">2-year conditional resident</option>
                    <option value="i485_approved">Permanent Resident approved</option>
                  </Select>
                </Field>
                <Field label="Preference category">
                  <Select defaultValue={profile.preferenceCategory} name="preferenceCategory">
                    {(() => {
                      const standardCategories = ALL_PREFERENCE_CATEGORIES;
                      const allCats = standardCategories.includes(profile.preferenceCategory)
                        ? standardCategories
                        : [profile.preferenceCategory, ...standardCategories];
                      return allCats.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ));
                    })()}
                  </Select>
                </Field>
                <Field label="Priority date">
                  <Input defaultValue={profile.priorityDate ?? ""} name="priorityDate" type="date" />
                </Field>
                <Field label="Sponsoring employer or petitioner">
                  <Input
                    defaultValue={profile.greenCardSponsor ?? ""}
                    name="greenCardSponsor"
                    placeholder="e.g. Prior Employer Inc., Current Employer, or Self-Petition (NIW)"
                  />
                  {profile.i140Approved ? (
                    <div className="mt-4">
                      <label htmlFor="settings-retained-i140-sponsor" className="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1">
                        Approved I-140 prior sponsor
                      </label>
                      <Input
                        defaultValue={profile.retainedPriorityDateSponsor ?? ""}
                        id="settings-retained-i140-sponsor"
                        name="retainedPriorityDateSponsor"
                        placeholder="e.g. Prior Employer Inc. (approved I-140)"
                      />
                      <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
                        The employer or petitioner that sponsored your approved Form I-140.
                      </p>
                    </div>
                  ) : profile.retainedPriorityDate ? (
                    <input type="hidden" name="retainedPriorityDateSponsor" value={profile.retainedPriorityDateSponsor ?? ""} />
                  ) : null}
                  <p className="mt-1 text-[12px] text-[var(--color-text-tertiary)]">
                    Never assumed to be your current employer. Naming the sponsoring company clarifies priority date retention and portability.
                  </p>
                </Field>
                <Field label="I-140 status">
                  <Select defaultValue={profile.i140Approved ? "true" : "false"} name="i140Approved">
                    <option value="false">Not approved yet</option>
                    <option value="true">I-140 approved</option>
                  </Select>
                </Field>
              </CardContent>
            </Card>

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
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <div>
                  <p className="text-label">Email settings</p>
                  <CardTitle className="mt-2">Choose which Haven updates land in your inbox</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Field label="Community replies">
                  <Select defaultValue={profile.communityReplyEmailNotifications ? "true" : "false"} name="communityReplyEmailNotifications">
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </Select>
                </Field>
                <p className="text-body-sm text-[var(--color-text-secondary)]">
                  Send an email when Haven starts notifying you about replies to your community posts and threads.
                </p>

                <Field label="Status updates">
                  <Select defaultValue={profile.statusUpdateEmailNotifications ? "true" : "false"} name="statusUpdateEmailNotifications">
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </Select>
                </Field>
                <p className="text-body-sm text-[var(--color-text-secondary)]">
                  Send an email when official immigration status inputs change, such as new monthly priority date bulletin movement for your queue.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button size="lg" type="submit">
              Save changes
            </Button>
          </div>
        </form>

        <GreenCardEditor initialPetitions={profile.immigrantPetitions ?? []} sources={sources} />
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
