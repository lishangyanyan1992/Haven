"use client";

import { useState } from "react";
import { ArrowRight, Bell, Briefcase, CalendarDays, Check, CheckCircle, ChevronDown, ChevronUp, FileText, FolderOpen, Info, Lock, Minus, ShieldCheck, Sparkles, User, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { publicTools, type ToolSlug } from "@/lib/tools";
import { cn } from "@/lib/utils";

type CutoffMode = "date" | "current" | "unavailable";
type ChecklistScenario = "layoff" | "transfer" | "stamping" | "adjustment";
type ChecklistTiming = "urgent" | "month" | "planning";
type PregnantValue = "no" | "yes" | "na";

const todayInputValue = formatDateInput(new Date());

const scenarioContent: Record<
  ChecklistScenario,
  {
    badge: string;
    title: string;
    summary: string;
    actions: string[];
    documents: string[];
    dependentDocuments: string[];
  }
> = {
  layoff: {
    badge: "Grace period response",
    title: "Layoff document pack",
    summary: "Pull the documents that clarify status, last day, and any bridge options before details get scattered.",
    actions: [
      "Confirm your actual employment end date, not just the meeting date, because it changes the grace-period timeline.",
      "Ask HR or immigration counsel whether your petition withdrawal has been initiated and when your final pay period closes.",
      "Book an attorney or employer-counsel consult early if you may pivot to transfer, B-2, or dependent status."
    ],
    documents: [
      "Passport biographic page and current visa stamp",
      "Latest I-94 record and every recent I-797 approval notice",
      "Recent pay stubs and employment verification letter",
      "Termination notice, separation email, or HR confirmation of last day worked",
      "Resume, current job description, and copies of prior filings if available"
    ],
    dependentDocuments: [
      "Dependent passports, I-94s, and approval notices",
      "Marriage certificate and birth certificates if dependents may change status with you"
    ]
  },
  transfer: {
    badge: "Employer change",
    title: "H-1B transfer packet",
    summary: "This is the packet a new employer or counsel usually asks for first so filing can start without back-and-forth.",
    actions: [
      "Confirm whether the new role title, location, or salary changed enough to affect the filing strategy.",
      "Collect the last three months of pay evidence now; this is usually the item people scramble for later.",
      "Check whether any travel is planned before filing or before receipt notice issuance."
    ],
    documents: [
      "Passport, visa stamp, and latest I-94",
      "All prior I-797 approval notices and prior H-1B receipt notices",
      "Recent pay stubs, W-2s, and most recent resume",
      "Current offer letter and basic role details for the new position",
      "Diploma, transcripts, and credential evaluation if one was used before"
    ],
    dependentDocuments: [
      "Dependent approval notices and I-94s if the new employer may coordinate family extensions"
    ]
  },
  stamping: {
    badge: "Travel prep",
    title: "Visa stamping packet",
    summary: "Build the consular packet before booking travel so you know what is still missing.",
    actions: [
      "Verify your passport validity and appointment timing before booking non-refundable travel.",
      "Ask your employer for a current employment verification letter close to the appointment date.",
      "If you work at a client site, confirm whether a client letter or itinerary is still expected."
    ],
    documents: [
      "Passport, current and prior visa stamps, and DS-160 confirmation",
      "Interview appointment confirmation and passport-style photos if required by the post",
      "Latest I-797 approval notice, LCA copy if counsel provides one, and recent pay stubs",
      "Employment verification letter and recent tax documents if available",
      "Travel history and prior immigration approval records"
    ],
    dependentDocuments: [
      "Marriage certificate, birth certificates, and dependent appointment confirmations"
    ]
  },
  adjustment: {
    badge: "Green card prep",
    title: "Adjustment-of-status packet",
    summary: "Use this as a readiness check before counsel asks for the civil and immigration history set.",
    actions: [
      "Confirm which chart USCIS is using this month before assuming you are ready to file.",
      "Start civil-document collection early because replacements and translations often take longer than expected.",
      "Review address, travel, and employment history now while the details are easy to reconstruct."
    ],
    documents: [
      "Passport, visa history, I-94, and all recent approval notices",
      "Birth certificate with translation if needed, plus marriage certificate if applicable",
      "I-140 approval notice, priority date evidence, and recent employment verification",
      "Vaccination history and medical-exam planning notes",
      "Two passport photos and prior immigration filing copies"
    ],
    dependentDocuments: [
      "Civil records and immigration approvals for each derivative family member"
    ]
  }
};

function parseDateInput(value: string) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function diffUtcDays(later: Date, earlier: Date) {
  return Math.round((later.getTime() - earlier.getTime()) / 86_400_000);
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthsLabel(days: number) {
  const months = Math.max(1, Math.round(days / 30));
  return `${months} month${months === 1 ? "" : "s"}`;
}

function getTimingCopy(timing: ChecklistTiming) {
  switch (timing) {
    case "urgent":
      return "Prioritize identity, status, and employer records first. Everything else can follow once the core packet is safe.";
    case "month":
      return "You have enough time to tighten the packet and identify missing items before a filing window opens.";
    default:
      return "Use this as a preparation pass so you are not starting from zero when timing becomes real.";
  }
}

const toolIcons: Record<ToolSlug, typeof ShieldCheck> = {
  "uscis-vaccine-finder": ShieldCheck,
  "grace-period-calculator": CalendarDays,
  "priority-date-checker": Sparkles,
  "document-pack-builder": FolderOpen
};

export function ToolsWorkspace({
  toolSlugs,
  showDirectory = true,
  showCta = true
}: {
  toolSlugs?: ToolSlug[];
  showDirectory?: boolean;
  showCta?: boolean;
}) {
  const todayDate = new Date();
  const [employmentEndDate, setEmploymentEndDate] = useState(todayInputValue);
  const [i94ExpiryDate, setI94ExpiryDate] = useState("");
  const [priorityDate, setPriorityDate] = useState("");
  const [cutoffMode, setCutoffMode] = useState<CutoffMode>("date");
  const [cutoffDate, setCutoffDate] = useState("");
  const [category, setCategory] = useState("EB-2");
  const [country, setCountry] = useState("India");
  const [chartType, setChartType] = useState("Final Action Date");
  const [scenario, setScenario] = useState<ChecklistScenario>("layoff");
  const [timing, setTiming] = useState<ChecklistTiming>("urgent");
  const [includeDependents, setIncludeDependents] = useState("yes");
  const [birthDate, setBirthDate] = useState("");
  const [examDate, setExamDate] = useState(todayInputValue);
  const [pregnant, setPregnant] = useState<PregnantValue>("no");
  const [showNotNeeded, setShowNotNeeded] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailValue, setEmailValue] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  const employmentDate = parseDateInput(employmentEndDate);
  const i94Date = parseDateInput(i94ExpiryDate);
  const today = parseDateInput(todayInputValue);
  const assumedGraceDeadline = employmentDate ? addUtcDays(employmentDate, 60) : null;
  const graceDeadline =
    assumedGraceDeadline && i94Date
      ? new Date(Math.min(assumedGraceDeadline.getTime(), i94Date.getTime()))
      : assumedGraceDeadline;
  const graceDaysRemaining = graceDeadline && today ? diffUtcDays(graceDeadline, today) : null;

  const parsedPriorityDate = parseDateInput(priorityDate);
  const parsedCutoffDate = parseDateInput(cutoffDate);
  const checklist = scenarioContent[scenario];
  const vaccineAssessment = getVaccineAssessment(
    parseDateInput(birthDate),
    parseDateInput(examDate),
    pregnant
  );
  const selectedTools = toolSlugs ? publicTools.filter((tool) => toolSlugs.includes(tool.slug)) : publicTools;
  const selectedToolSet = new Set(selectedTools.map((tool) => tool.slug));
  const hasTool = (slug: ToolSlug) => selectedToolSet.has(slug);

  const priorityStatus =
    cutoffMode === "current"
      ? {
          title: `${category} is current for ${country}`,
          tone: "tag-active",
          body: `${chartType} is marked current, so a ${formatPriorityScope(category, country)} with priority date ${priorityDate || "not entered yet"} is not blocked by the cutoff itself.`
        }
      : cutoffMode === "unavailable"
        ? {
            title: `${category} is unavailable for ${country}`,
            tone: "tag-urgent",
            body: `${chartType} is unavailable, so this filing path is not open on the published bulletin.`
          }
        : parsedPriorityDate && parsedCutoffDate
          ? parsedPriorityDate.getTime() <= parsedCutoffDate.getTime()
            ? {
                title: "Your priority date is current against the cutoff",
                tone: "tag-active",
                body: `${priorityDate} is on or before the published ${chartType.toLowerCase()} cutoff of ${cutoffDate} for ${formatPriorityScope(category, country)}.`
              }
            : {
                title: "Your priority date is still waiting on the cutoff",
                tone: "tag-pending",
                body: `${priorityDate} is ${getMonthsLabel(
                  diffUtcDays(parsedPriorityDate, parsedCutoffDate)
                )} behind the published cutoff date of ${cutoffDate} for ${formatPriorityScope(category, country)}.`
              }
          : null;

  async function handleEmailSend() {
    if (!emailValue || !vaccineAssessment) return;
    setEmailLoading(true);
    setEmailError("");
    try {
      const res = await fetch("/api/tools/vaccine-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailValue,
          examDate,
          ageLabel: vaccineAssessment.ageLabel,
          ageBucket: vaccineAssessment.ageBucket,
          required: vaccineAssessment.required,
        }),
      });
      if (!res.ok) throw new Error("send_failed");
      setEmailSent(true);
    } catch {
      setEmailError("Something went wrong — please try again.");
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {showDirectory ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {selectedTools.map((tool) => {
            const Icon = toolIcons[tool.slug];

            return (
          <a
            key={tool.title}
            href={`/tools/${tool.slug}`}
            className="group rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 shadow-[0_8px_32px_-12px_rgba(44,54,48,0.12)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_-12px_rgba(44,54,48,0.18)]"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="text-h2 mt-4">{tool.title}</h2>
            <p className="text-body-sm mt-3">{tool.teaser}</p>
            <span className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--haven-ink)]">
              Open tool
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </span>
          </a>
            );
          })}
        </section>
      ) : null}

      {hasTool("uscis-vaccine-finder") ? (
      <section
        id="uscis-vaccine-finder"
        className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 shadow-[0_10px_40px_-14px_rgba(44,54,48,0.12)] md:p-8"
      >
        {/* Section header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-3 py-1">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--haven-ink)]" />
            <p className="text-[11px] font-medium tracking-wide text-[var(--haven-ink-mid)]">USCIS · Form I-693 · medical exam</p>
          </div>
          <h2 className="text-h1 mt-5 max-w-[26ch]">Find out exactly what vaccines your civil surgeon will require.</h2>
          <p className="text-body mt-4 max-w-[64ch]">
            Built from the CDC civil-surgeon table that drives the I-693 vaccination review. Two dates and one short question — your list takes about 30 seconds.
          </p>
        </div>

        {/* Two-column workspace */}
        <div className="grid gap-6 lg:grid-cols-[400px_1fr]">

          {/* LEFT — form card */}
          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 shadow-[0_2px_12px_-4px_rgba(44,54,48,0.08)]">
            <div className="flex items-center justify-between">
              <h3 className="text-h3">Your situation</h3>
              <span className="text-body-sm text-[var(--haven-ink-mid)]">Step 1 of 1</span>
            </div>
            <p className="mt-1 mb-6 text-body-sm text-[var(--haven-ink-mid)]">Nothing leaves your browser until you choose to share an email.</p>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label" htmlFor="vaccine-birth-date">Date of birth</label>
                <Input
                  id="vaccine-birth-date"
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="vaccine-exam-date">
                  Medical exam date
                </label>
                <Input
                  id="vaccine-exam-date"
                  type="date"
                  value={examDate}
                  onChange={(event) => setExamDate(event.target.value)}
                />
              </div>
            </div>

            {/* Age indicator — appears once dates are valid */}
            {vaccineAssessment && (
              <div className="mt-3 flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--haven-sand)] px-4 py-3">
                <User className="h-4 w-4 flex-shrink-0 text-[var(--haven-ink)]" />
                <span className="text-body-sm text-[var(--haven-ink-mid)]">
                  Age <strong className="text-[var(--haven-ink)]">{vaccineAssessment.ageLabel}</strong> on exam day · CDC age band <strong className="text-[var(--haven-ink)]">{vaccineAssessment.ageBucket}</strong>
                </span>
              </div>
            )}

            <hr className="my-6 border-[var(--color-border)]" />

            {/* Pregnancy toggle */}
            <div>
              <label className="field-label mb-3 block">Will you be pregnant on exam day?</label>
              <div className="flex gap-2">
                {([["no", "No"], ["yes", "Yes"], ["na", "Prefer not to say"]] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPregnant(value)}
                    className={cn(
                      "flex-1 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-medium transition-all duration-200",
                      pregnant === value
                        ? "border-[var(--haven-ink)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]"
                        : "border-[var(--color-border)] bg-[var(--haven-white)] text-[var(--haven-ink-mid)] hover:border-[var(--color-border-strong)]"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {pregnant === "yes" && (
                <div className="mt-3 flex items-start gap-2">
                  <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                  <p className="text-body-sm text-amber-700">MMR &amp; Varicella are live vaccines — your civil surgeon will note them and defer until post-partum.</p>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT — live result */}
          <div className="flex flex-col overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] shadow-[0_2px_12px_-4px_rgba(44,54,48,0.08)]">
            {!vaccineAssessment ? (
              <div className="flex flex-1 flex-col items-center justify-center p-12 text-center" style={{ minHeight: 320 }}>
                <CalendarDays className="h-8 w-8 text-[var(--haven-ink-mid)]" />
                <p className="mt-4 text-body text-[var(--haven-ink-mid)]">Enter your dates to see your list.</p>
              </div>
            ) : (
              <>
                {/* Result header */}
                <div className="border-b border-[var(--color-border)] bg-[var(--haven-sand)] px-6 py-5">
                  <div className="flex items-center justify-between">
                    <span className="text-label text-[var(--haven-ink)]">Your assessment</span>
                    <span className="flex items-center gap-2 text-body-sm text-[var(--haven-ink-mid)]">
                      <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                      Updated live
                    </span>
                  </div>
                  <h2 className="mt-2 font-[family-name:var(--font-display)] text-[2rem] font-light leading-tight tracking-tight">
                    {vaccineAssessment.required.length} vaccine{vaccineAssessment.required.length === 1 ? "" : "s"} required{" "}
                    <span className="text-[var(--haven-ink-mid)]">at your exam.</span>
                  </h2>
                  <p className="mt-1.5 text-body-sm">
                    Based on age band <strong>{vaccineAssessment.ageBucket}</strong>, exam on <strong>{formatExamDate(examDate)}</strong>.
                  </p>
                </div>

                {/* Required vaccines list */}
                <div className="divide-y divide-[var(--color-border)]">
                  {vaccineAssessment.required.map((v) => (
                    <div key={v.name} className="grid items-center gap-4 px-4 py-3" style={{ gridTemplateColumns: "28px 1fr auto" }}>
                      <div className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--haven-ink)] text-white">
                        <Check className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-body font-medium text-[var(--haven-ink)]">{v.name}</p>
                        {v.reason && <p className="mt-0.5 text-body-sm text-[var(--haven-ink-mid)]">{v.reason}</p>}
                      </div>
                      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                        Required
                      </span>
                    </div>
                  ))}
                </div>

                {/* Not needed accordion */}
                <div className="border-t border-[var(--color-border)] bg-[var(--haven-sand)]">
                  <button
                    type="button"
                    onClick={() => setShowNotNeeded(!showNotNeeded)}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                  >
                    <span className="text-body-sm font-medium text-[var(--haven-ink-mid)]">
                      {vaccineAssessment.notNeeded.length} vaccine{vaccineAssessment.notNeeded.length === 1 ? "" : "s"} not required at your age
                    </span>
                    {showNotNeeded
                      ? <ChevronUp className="h-4 w-4 text-[var(--haven-ink-mid)]" />
                      : <ChevronDown className="h-4 w-4 text-[var(--haven-ink-mid)]" />}
                  </button>
                  {showNotNeeded && (
                    <div className="space-y-1 px-4 pb-4">
                      {vaccineAssessment.notNeeded.map((v) => (
                        <div key={v.name} className="flex items-center gap-3 py-1">
                          <Minus className="h-3.5 w-3.5 flex-shrink-0 text-[var(--haven-ink-mid)]" />
                          <span className="text-body-sm text-[var(--haven-ink-mid)]">{v.name}</span>
                          {v.reason && <span className="ml-auto text-body-sm text-[var(--haven-ink-mid)]">{v.reason}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Email capture */}
                <div className="border-t border-[var(--color-border)] bg-[var(--haven-sage-light)] p-6">
                  {emailSent ? (
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 flex-shrink-0 text-[var(--haven-ink)]" />
                      <div>
                        <p className="font-semibold text-[var(--haven-ink)]">Sent — check your inbox.</p>
                        <p className="mt-0.5 text-body-sm text-[var(--haven-ink-mid)]">PDF + reminders 14 / 7 / 1 days before {formatExamDate(examDate)}.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-baseline justify-between">
                        <h3 className="text-h3">Take this with you.</h3>
                        <span className="flex items-center gap-1 text-body-sm text-[var(--haven-ink)]">
                          <Bell className="h-3 w-3" /> + reminders before your exam
                        </span>
                      </div>
                      <p className="mt-2 mb-3 text-body-sm text-[var(--haven-ink-mid)]">Email yourself your vaccine checklist for the civil surgeon appointment.</p>
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          placeholder="you@email.com"
                          value={emailValue}
                          onChange={(event) => { setEmailValue(event.target.value); setEmailError(""); }}
                          onKeyDown={(event) => { if (event.key === "Enter") handleEmailSend(); }}
                          className="flex-1"
                          disabled={emailLoading}
                        />
                        <Button onClick={handleEmailSend} disabled={emailLoading || !emailValue}>
                          {emailLoading ? "Sending…" : <>Email my list <ArrowRight className="h-4 w-4" /></>}
                        </Button>
                      </div>
                      {emailError && <p className="mt-2 text-body-sm text-red-600">{emailError}</p>}
                      {!emailError && <p className="mt-2 text-body-sm text-[var(--haven-ink-mid)]">Free. No account.</p>}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-8 flex flex-wrap items-center gap-6 border-t border-[var(--color-border)] pt-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--haven-ink)]" />
            <span className="text-body-sm">Source: CDC Vaccination Technical Instructions, Table 1 (effective March 11, 2025)</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[var(--haven-ink)]" />
            <span className="text-body-sm">Calculated locally — your dates aren't stored.</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[var(--haven-ink)]" />
            <span className="text-body-sm">12,400+ adjustment-of-status applicants helped this year</span>
          </div>
        </div>
      </section>
      ) : null}

      {hasTool("grace-period-calculator") ? (
      <section
        id="grace-period-calculator"
        className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 shadow-[0_10px_40px_-14px_rgba(44,54,48,0.12)] md:p-8"
      >
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-3 py-1">
              <CalendarDays className="h-3.5 w-3.5 text-[var(--haven-ink)]" />
              <p className="text-[11px] font-medium tracking-wide text-[var(--haven-ink-mid)]">Free tool</p>
            </div>
            <h2 className="text-h1 mt-5">Grace period calculator</h2>
            <p className="text-body mt-4">
              Use this to estimate the last day of an H-1B grace period based on the earlier of 60 calendar days after employment ends or your I-94 expiration date.
            </p>
            <div className="mt-6 rounded-[var(--radius-xl)] bg-[var(--haven-sand)] p-5">
              <p className="text-h3">How to use it</p>
              <p className="text-body-sm mt-2">
                Enter your actual employment end date. If you know your current I-94 expiration, add that too so the tool can cap the result correctly.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-5">
              <div>
                <label className="field-label" htmlFor="employment-end-date">
                  Employment end date
                </label>
                <Input
                  id="employment-end-date"
                  type="date"
                  value={employmentEndDate}
                  onChange={(event) => setEmploymentEndDate(event.target.value)}
                />
                <p className="field-helper">Use the date your employment actually ended, not the day you first heard about the change.</p>
              </div>

              <div>
                <label className="field-label" htmlFor="i94-expiry-date">
                  I-94 expiration date
                </label>
                <Input
                  id="i94-expiry-date"
                  type="date"
                  value={i94ExpiryDate}
                  onChange={(event) => setI94ExpiryDate(event.target.value)}
                />
                <p className="field-helper">Optional, but useful because the grace period cannot run past your I-94.</p>
              </div>
            </div>

            <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-cream)] p-5">
              <p className="text-label">Estimate</p>
              {graceDeadline ? (
                <>
                  <p className="mt-3 font-[family-name:var(--font-display)] text-[2rem] leading-none tracking-tight text-[var(--haven-ink)]">
                    {formatLongDate(graceDeadline)}
                  </p>
                  <p className="text-body-sm mt-3">
                    This assumes the end of the grace period is the earlier of 60 calendar days after your job ended or your current I-94 expiration.
                  </p>
                  {graceDaysRemaining !== null ? (
                    <div
                      className={cn(
                        "mt-5 rounded-[var(--radius-xl)] px-4 py-4",
                        graceDaysRemaining >= 0 ? "bg-[var(--haven-sage-light)]" : "bg-[var(--haven-blush-light)]"
                      )}
                    >
                      <p className="text-h3">
                        {graceDaysRemaining >= 0
                          ? `${graceDaysRemaining} day${graceDaysRemaining === 1 ? "" : "s"} remaining from today`
                          : `${Math.abs(graceDaysRemaining)} day${Math.abs(graceDaysRemaining) === 1 ? "" : "s"} past this estimate`}
                      </p>
                      <p className="text-body-sm mt-2">
                        USCIS treats the grace period as discretionary, so use this as planning support rather than legal confirmation.
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-body-sm mt-3">Enter an employment end date to calculate the estimated deadline.</p>
              )}
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {hasTool("priority-date-checker") ? (
      <section
        id="priority-date-checker"
        className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 shadow-[0_10px_40px_-14px_rgba(44,54,48,0.12)] md:p-8"
      >
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-[var(--haven-sky-ink)]" />
              <p className="text-[11px] font-medium tracking-wide text-[var(--haven-sky-ink)]">Visa Bulletin helper</p>
            </div>
            <h2 className="text-h1 mt-5">Priority date checker</h2>
            <p className="text-body mt-4">
              Plug in your own priority date and compare it with the published cutoff you are looking at. It is a fast way to see whether the date itself is blocking you.
            </p>
            <div className="mt-6 rounded-[var(--radius-xl)] bg-[var(--haven-sand)] p-5">
              <p className="text-h3">Keep in mind</p>
              <p className="text-body-sm mt-2">
                USCIS decides each month whether adjustment filings use Final Action Dates or Dates for Filing. This tool helps with the math, not the monthly policy call.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="priority-category">
                  Category
                </label>
                <Select id="priority-category" value={category} onChange={(event) => setCategory(event.target.value)}>
                  <option>EB-1</option>
                  <option>EB-2</option>
                  <option>EB-3</option>
                  <option>Family-based</option>
                </Select>
              </div>
              <div>
                <label className="field-label" htmlFor="priority-country">
                  Chargeability
                </label>
                <Select id="priority-country" value={country} onChange={(event) => setCountry(event.target.value)}>
                  <option>India</option>
                  <option>China</option>
                  <option>All chargeability areas except listed</option>
                  <option>Mexico</option>
                  <option>Philippines</option>
                </Select>
              </div>
              <div>
                <label className="field-label" htmlFor="priority-chart-type">
                  Chart
                </label>
                <Select id="priority-chart-type" value={chartType} onChange={(event) => setChartType(event.target.value)}>
                  <option>Final Action Date</option>
                  <option>Dates for Filing</option>
                </Select>
              </div>
              <div>
                <label className="field-label" htmlFor="cutoff-mode">
                  Bulletin status
                </label>
                <Select
                  id="cutoff-mode"
                  value={cutoffMode}
                  onChange={(event) => setCutoffMode(event.target.value as CutoffMode)}
                >
                  <option value="date">Published cutoff date</option>
                  <option value="current">Current</option>
                  <option value="unavailable">Unavailable</option>
                </Select>
              </div>
              <div>
                <label className="field-label" htmlFor="priority-date">
                  Your priority date
                </label>
                <Input
                  id="priority-date"
                  type="date"
                  value={priorityDate}
                  onChange={(event) => setPriorityDate(event.target.value)}
                />
              </div>
              {cutoffMode === "date" ? (
                <div>
                  <label className="field-label" htmlFor="cutoff-date">
                    Published cutoff date
                  </label>
                  <Input
                    id="cutoff-date"
                    type="date"
                    value={cutoffDate}
                    onChange={(event) => setCutoffDate(event.target.value)}
                  />
                </div>
              ) : null}
            </div>

            <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-cream)] p-5">
              <p className="text-label">Result</p>
              {priorityStatus ? (
                <>
                  <span className={cn("mt-3 inline-flex tag", priorityStatus.tone)}>{priorityStatus.title}</span>
                  <p className="text-body-sm mt-4">{priorityStatus.body}</p>
                </>
              ) : (
                <p className="text-body-sm mt-3">Enter your priority date and the published cutoff to compare them.</p>
              )}
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {hasTool("document-pack-builder") ? (
      <section
        id="document-pack-builder"
        className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-6 shadow-[0_10px_40px_-14px_rgba(44,54,48,0.12)] md:p-8"
      >
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] px-3 py-1">
              <Briefcase className="h-3.5 w-3.5 text-[var(--haven-blush-ink)]" />
              <p className="text-[11px] font-medium tracking-wide text-[var(--haven-blush-ink)]">Action prep</p>
            </div>
            <h2 className="text-h1 mt-5">Document pack builder</h2>
            <p className="text-body mt-4">
              Pick the situation you are in and Haven will surface the packet that usually matters first. This is built to reduce scramble, not to replace counsel instructions.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="scenario">
                  Situation
                </label>
                <Select id="scenario" value={scenario} onChange={(event) => setScenario(event.target.value as ChecklistScenario)}>
                  <option value="layoff">Layoff or grace period</option>
                  <option value="transfer">H-1B transfer</option>
                  <option value="stamping">Visa stamping</option>
                  <option value="adjustment">Adjustment of status</option>
                </Select>
              </div>
              <div>
                <label className="field-label" htmlFor="timing">
                  Timing
                </label>
                <Select id="timing" value={timing} onChange={(event) => setTiming(event.target.value as ChecklistTiming)}>
                  <option value="urgent">Need it this week</option>
                  <option value="month">Need it this month</option>
                  <option value="planning">Planning ahead</option>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="dependents">
                  Include dependent-family documents
                </label>
                <Select id="dependents" value={includeDependents} onChange={(event) => setIncludeDependents(event.target.value)}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </div>
            </div>

            <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-cream)] p-5">
              <span className="tag tag-urgent">{checklist.badge}</span>
              <h3 className="text-h2 mt-4">{checklist.title}</h3>
              <p className="text-body-sm mt-3">{checklist.summary}</p>
              <div className="mt-5 rounded-[var(--radius-xl)] bg-[var(--haven-white)] p-4">
                <p className="text-h3">Timing note</p>
                <p className="text-body-sm mt-2">{getTimingCopy(timing)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-sand)] p-6">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--haven-ink)]" />
              <p className="text-h3">Core documents</p>
            </div>
            <ul className="mt-4 space-y-3 pl-5">
              {checklist.documents.map((document) => (
                <li key={document} className="text-body list-disc">
                  {document}
                </li>
              ))}
              {includeDependents === "yes"
                ? checklist.dependentDocuments.map((document) => (
                    <li key={document} className="text-body list-disc">
                      {document}
                    </li>
                  ))
                : null}
            </ul>
          </div>

          <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-white)] p-6 shadow-[inset_0_0_0_1px_var(--color-border)]">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-[var(--haven-ink)]" />
              <p className="text-h3">Next actions</p>
            </div>
            <ul className="mt-4 space-y-3 pl-5">
              {checklist.actions.map((action) => (
                <li key={action} className="text-body list-disc">
                  {action}
                </li>
              ))}
            </ul>
            <div className="mt-6 rounded-[var(--radius-xl)] bg-[var(--haven-sage-light)] p-4">
              <p className="text-body-sm">
                Best practice: store the packet in one folder now and rename files consistently before you share them with counsel or an employer.
              </p>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {showCta ? (
      <section className="rounded-[var(--radius-2xl)] bg-[var(--haven-ink)] px-6 py-8 text-[var(--haven-cream)] md:px-8">
        <p className="text-label text-[rgba(253,250,246,0.62)]">Need the full product?</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[52ch]">
            <h2 className="text-h1 text-[var(--haven-cream)]">Free tools for the first pass. Haven for the full decision workflow.</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[rgba(253,250,246,0.72)]">
              The public tools help with immediate calculations and document prep. The full app adds a personalized timeline, crisis planning, and guidance organized around your own case.
            </p>
          </div>
          <Button
            className="w-full md:w-auto"
            variant="cream"
            onClick={() => {
              window.location.href = "/register";
            }}
          >
            Create a Haven profile
          </Button>
        </div>
      </section>
      ) : null}
    </div>
  );
}

function formatPriorityScope(category: string, country: string) {
  return `${category} for ${country}`;
}

// CDC Vaccination Technical Instructions, Table 1 (effective March 11, 2025)
const VACCINE_AGE_BUCKETS = [
  { id: "a", label: "Birth–1 mo" },
  { id: "b", label: "2–11 mo" },
  { id: "c", label: "12 mo–6 yrs" },
  { id: "d", label: "7–10 yrs" },
  { id: "e", label: "11–17 yrs" },
  { id: "f", label: "18–64 yrs" },
  { id: "g", label: "≥ 65 yrs" },
] as const;

type VaccineBucketId = (typeof VACCINE_AGE_BUCKETS)[number]["id"];

interface VaccineEntry {
  id: string;
  name: string;
  by: Record<VaccineBucketId, string>;
  note?: string;
}

const CDC_VACCINES: VaccineEntry[] = [
  { id: "dtp",  name: "DTP / DTaP / DT",         by: { a: "no",  b: "yes",        c: "yes",        d: "no",         e: "no",       f: "no",     g: "no"  } },
  { id: "tdap", name: "Tdap / Td",                by: { a: "no",  b: "no",         c: "no",         d: "sometimes",  e: "yes",      f: "yes",    g: "yes" }, note: "Required if no record of primary series — bring vaccination records." },
  { id: "polio",name: "Polio",                    by: { a: "no",  b: "yes",        c: "yes",        d: "yes",        e: "yes",      f: "yes",    g: "yes" }, note: "Refer to ACIP for adults without primary series. Positive titer also accepted." },
  { id: "mmr",  name: "Measles, Mumps, Rubella", by: { a: "no",  b: "no",         c: "yes-1957",   d: "yes-1957",   e: "yes-1957", f: "yes-1957", g: "no" }, note: "Required if born in 1957 or later." },
  { id: "rota", name: "Rotavirus",               by: { a: "no",  b: "yes-window", c: "no",         d: "no",         e: "no",       f: "no",     g: "no"  }, note: "Only 6 weeks–8 months old. Not initiated after 15 weeks 0 days." },
  { id: "hib",  name: "Hib",                     by: { a: "no",  b: "yes",        c: "yes-59mo",   d: "no",         e: "no",       f: "no",     g: "no"  }, note: "2 through 59 months old." },
  { id: "hepa", name: "Hepatitis A",             by: { a: "no",  b: "no",         c: "yes-12-18",  d: "yes-12-18",  e: "yes-12-18", f: "no",    g: "no"  }, note: "12 months through 18 years old." },
  { id: "hepb", name: "Hepatitis B",             by: { a: "yes", b: "yes",        c: "yes",        d: "yes",        e: "yes",      f: "yes-59", g: "no"  }, note: "3 doses or positive titer accepted." },
  { id: "men",  name: "Meningococcal (MenACWY)", by: { a: "no",  b: "no",         c: "no",         d: "no",         e: "yes-11-18", f: "no",    g: "no"  }, note: "11 through 18 years old." },
  { id: "var",  name: "Varicella",               by: { a: "no",  b: "no",         c: "yes",        d: "yes",        e: "yes",      f: "yes",    g: "yes" } },
  { id: "pcv",  name: "Pneumococcal",            by: { a: "no",  b: "yes-2-59mo", c: "yes-2-59mo", d: "no",         e: "no",       f: "no",     g: "yes" }, note: "Children 2–59 months (PCV) or adults ≥ 65." },
  { id: "flu",  name: "Influenza",               by: { a: "no-under6mo", b: "yes-flu", c: "yes-flu", d: "yes-flu", e: "yes-flu",   f: "yes-flu", g: "yes-flu" }, note: "Required when available in the U.S. (≈ Oct–May). Annually." },
  { id: "cov",  name: "COVID-19",                by: { a: "no-under6mo", b: "yes", c: "yes",        d: "yes",        e: "yes",      f: "yes",    g: "yes" }, note: "See CDC COVID-19 section for current dose schedule." },
];

function getVaccineBucket(birthDate: Date, examDate: Date): (typeof VACCINE_AGE_BUCKETS)[number] | null {
  let months =
    (examDate.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 +
    (examDate.getUTCMonth() - birthDate.getUTCMonth());
  if (examDate.getUTCDate() < birthDate.getUTCDate()) months -= 1;
  if (months < 0) return null;
  if (months < 2)   return VACCINE_AGE_BUCKETS[0];
  if (months < 12)  return VACCINE_AGE_BUCKETS[1];
  if (months < 84)  return VACCINE_AGE_BUCKETS[2]; // < 7 years
  if (months < 132) return VACCINE_AGE_BUCKETS[3]; // < 11 years
  if (months < 216) return VACCINE_AGE_BUCKETS[4]; // < 18 years
  if (months < 780) return VACCINE_AGE_BUCKETS[5]; // < 65 years
  return VACCINE_AGE_BUCKETS[6];
}

function fluInSeason(examDate: Date): boolean {
  const m = examDate.getUTCMonth();
  return m >= 9 || m <= 4; // Oct–May
}

function formatExamDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function getVaccineAssessment(
  birthDate: Date | null,
  examDate: Date | null,
  pregnant: PregnantValue
): { ageLabel: string; ageBucket: string; required: { name: string; reason: string }[]; notNeeded: { name: string; reason: string }[] } | null {
  if (!birthDate || !examDate || birthDate.getTime() >= examDate.getTime()) return null;

  const bucket = getVaccineBucket(birthDate, examDate);
  if (!bucket) return null;

  const bornBefore1957 = birthDate.getUTCFullYear() < 1957;
  const fluAvailable = fluInSeason(examDate);
  const required: { name: string; reason: string }[] = [];
  const notNeeded: { name: string; reason: string }[] = [];

  for (const v of CDC_VACCINES) {
    const raw = v.by[bucket.id as VaccineBucketId];
    let status: "required" | "not-needed" = "not-needed";
    let reason = "";

    if (raw === "yes") {
      status = "required";
    } else if (raw === "no" || raw === "no-under6mo") {
      status = "not-needed";
    } else if (raw === "sometimes") {
      status = "required";
      reason = "Required if no record of primary series — bring vaccination records.";
    } else if (raw === "yes-1957") {
      if (bornBefore1957) {
        status = "not-needed";
        reason = "Not required — born before 1957.";
      } else {
        status = "required";
        reason = "Required (born 1957 or later).";
      }
    } else if (
      raw === "yes-window" ||
      raw === "yes-59mo" ||
      raw === "yes-2-59mo" ||
      raw === "yes-12-18" ||
      raw === "yes-11-18"
    ) {
      status = "required";
      reason = v.note ?? "";
    } else if (raw === "yes-59") {
      status = "required";
      reason = "3 doses or positive titer accepted.";
    } else if (raw === "yes-flu") {
      if (fluAvailable) {
        status = "required";
        reason = "In flu season at exam date — required when available.";
      } else {
        status = "not-needed";
        reason = "Exam falls outside U.S. flu season — not required.";
      }
    }

    // Live vaccines during pregnancy: still required but timing-deferred
    if (pregnant === "yes" && (v.id === "mmr" || v.id === "var") && status === "required") {
      reason = "Live vaccine — civil surgeon will note and defer until post-partum.";
    }

    const entry = { name: v.name, reason: reason || v.note || "" };
    if (status === "required") required.push(entry);
    else notNeeded.push(entry);
  }

  // Compute age label
  let totalMonths =
    (examDate.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 +
    (examDate.getUTCMonth() - birthDate.getUTCMonth());
  if (examDate.getUTCDate() < birthDate.getUTCDate()) totalMonths -= 1;
  const totalDays = Math.round((examDate.getTime() - birthDate.getTime()) / 86_400_000);
  const years = Math.floor(totalMonths / 12);

  let ageLabel: string;
  if (years >= 2) ageLabel = `${years} years old`;
  else if (totalMonths >= 1) ageLabel = `${totalMonths} month${totalMonths === 1 ? "" : "s"} old`;
  else ageLabel = `${totalDays} day${totalDays === 1 ? "" : "s"} old`;

  return { ageLabel, ageBucket: bucket.label, required, notNeeded };
}
