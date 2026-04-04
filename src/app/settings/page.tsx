import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getSnapshot } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";
import { saveProfileSettingsAction } from "@/server/actions";

export const metadata = noIndexMetadata;

function inferGreenCardStage(profile: Awaited<ReturnType<typeof getSnapshot>>["profile"]) {
  if (profile.i485Filed) return "i485_filed";
  if (profile.i140Approved) return "i140_approved";
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
  const [{ profile }, crisisState] = await Promise.all([getSnapshot(), getCrisisState()]);
  const greenCardStage = inferGreenCardStage(profile);

  return (
    <AppShell activePath="/settings" crisisState={crisisState}>
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
            Profile updated. Haven is now using the information below across the app.
          </div>
        )}

        <form action={saveProfileSettingsAction} className="space-y-6">
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
                  <Select defaultValue={profile.visaType} name="visaType">
                    {["OPT", "STEM OPT", "H1B", "H4", "O-1", "GC", "Citizen"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Country of birth">
                  <Select defaultValue={profile.countryOfBirth} name="countryOfBirth">
                    {["India", "China", "Mexico", "Philippines", "South Korea", "Brazil", "Canada", "United Kingdom", "Other"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
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
                </Field>
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
                    <option value="perm_in_progress">PERM in progress</option>
                    <option value="perm_certified">PERM certified</option>
                    <option value="i140_filed">I-140 filed</option>
                    <option value="i140_approved">I-140 approved</option>
                    <option value="i485_filed">I-485 filed</option>
                  </Select>
                </Field>
                <Field label="Preference category">
                  <Select defaultValue={profile.preferenceCategory} name="preferenceCategory">
                    {["EB-1", "EB-2", "EB-3", "EB-2 NIW", "Not sure"].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Priority date">
                  <Input defaultValue={profile.priorityDate ?? ""} name="priorityDate" type="date" />
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
                  <p className="text-label">Top concerns</p>
                  <CardTitle className="mt-2">What Haven should prioritize first</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-body-sm">
                  These selections influence your dashboard guidance, planner emphasis, and community matching.
                </p>
                {[
                  ["layoffs", "Layoff risk", "Worried about job loss scenarios"],
                  ["visa_expiry", "Visa expiry", "Tracking current status expiration"],
                  ["gc_timeline", "Green card timeline", "Long waits and bulletin uncertainty"],
                  ["job_change", "Job change", "Transferring H1B or changing employers"]
                ].map(([value, label, description]) => (
                  <label
                    key={value}
                    className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-4"
                  >
                    <input
                      className="mt-1 h-4 w-4 accent-[var(--haven-sage)]"
                      defaultChecked={profile.topConcerns.includes(value as typeof profile.topConcerns[number])}
                      name="topConcerns"
                      type="checkbox"
                      value={value}
                    />
                    <div>
                      <p className="text-h3">{label}</p>
                      <p className="text-body-sm mt-2">{description}</p>
                    </div>
                  </label>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button size="lg" type="submit">
              Save changes
            </Button>
          </div>
        </form>
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
