"use client";

import { useState } from "react";
import { ArrowRight, Briefcase, CalendarDays, FileText, FolderOpen, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { publicTools, type ToolSlug } from "@/lib/tools";
import { cn } from "@/lib/utils";

type CutoffMode = "date" | "current" | "unavailable";
type ChecklistScenario = "layoff" | "transfer" | "stamping" | "adjustment";
type ChecklistTiming = "urgent" | "month" | "planning";
type VaccineTone = "tag-active" | "tag-pending";

const todayInputValue = formatDateInput(new Date());
const cdcVaccineSourceUrl = "https://www.cdc.gov/immigrant-refugee-health/hcp/civil-surgeons/vaccination.html";
const allVaccineNames = [
  "DTP/DTaP/DT",
  "Tdap/Td",
  "Polio",
  "Measles, mumps, rubella (MMR)",
  "Rotavirus",
  "Hib",
  "Hepatitis A",
  "Hepatitis B",
  "Meningococcal (MenACWY)",
  "Varicella",
  "Pneumococcal",
  "Influenza"
] as const;

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

function defaultFluAvailability(date: Date) {
  const month = date.getMonth() + 1;
  return month >= 10 || month <= 3 ? "yes" : "no";
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
  const [influenzaAvailable, setInfluenzaAvailable] = useState(defaultFluAvailability(todayDate));

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
    influenzaAvailable === "yes"
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
        <div className="grid gap-8 lg:grid-cols-[0.88fr_1.12fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-3 py-1">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--haven-ink)]" />
              <p className="text-[11px] font-medium tracking-wide text-[var(--haven-ink-mid)]">USCIS medical exam</p>
            </div>
            <h2 className="text-h1 mt-5">Vaccine requirement finder</h2>
            <p className="text-body mt-4">
              This tool maps age-based vaccine requirements for U.S. status-adjustment medical exams using the CDC civil-surgeon table that applies to Form I-693 vaccination review.
            </p>
            <div className="mt-6 rounded-[var(--radius-xl)] bg-[var(--haven-sand)] p-5">
              <p className="text-h3">What it covers</p>
              <p className="text-body-sm mt-2">
                Age is the first filter. Records, immunity, contraindications, and flu-season availability can still change what a civil surgeon actually gives you.
              </p>
              <a
                className="mt-3 inline-flex text-[13px] font-medium text-[var(--haven-ink)] underline-offset-2 hover:underline"
                href={cdcVaccineSourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Source: CDC Vaccination Technical Instructions, Table 1 (effective March 11, 2025)
              </a>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="vaccine-birth-date">
                  Date of birth
                </label>
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
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="influenza-availability">
                  Is influenza vaccine available at the time of the exam?
                </label>
                <Select
                  id="influenza-availability"
                  value={influenzaAvailable}
                  onChange={(event) => setInfluenzaAvailable(event.target.value)}
                >
                  <option value="yes">Yes, likely during U.S. flu season</option>
                  <option value="no">No, likely outside flu season</option>
                </Select>
                <p className="field-helper">CDC says influenza is required when available in the United States, usually from fall through early spring.</p>
              </div>
            </div>

            <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-cream)] p-5">
              <p className="text-label">Assessment</p>
              {vaccineAssessment ? (
                <>
                  <p className="mt-3 font-[family-name:var(--font-display)] text-[1.85rem] leading-none tracking-tight text-[var(--haven-ink)]">
                    {vaccineAssessment.ageLabel}
                  </p>
                  <p className="text-body-sm mt-3">
                    Age bucket: {vaccineAssessment.ageBucket}
                  </p>
                  <div className="mt-5 rounded-[var(--radius-xl)] bg-[var(--haven-white)] p-4">
                    <p className="text-h3">{vaccineAssessment.requiredNow.length} likely age-appropriate vaccine{vaccineAssessment.requiredNow.length === 1 ? "" : "s"} now</p>
                    <p className="text-body-sm mt-2">
                      {vaccineAssessment.requiredNow.length > 0
                        ? "These are the vaccines the CDC table flags for this age, before records and immunity are reviewed."
                        : "No vaccines are flagged by age alone for this exact setup, but history and other factors can still matter."}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-body-sm mt-3">Enter date of birth and exam date to see the age-based vaccine list.</p>
              )}
            </div>
          </div>
        </div>

        {vaccineAssessment ? (
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-sand)] p-6 lg:col-span-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--haven-ink)]" />
                <p className="text-h3">Likely age-appropriate now</p>
              </div>
              {vaccineAssessment.requiredNow.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {vaccineAssessment.requiredNow.map((item) => (
                    <div key={item.name} className="rounded-[var(--radius-xl)] bg-[var(--haven-white)] p-4">
                      <span className={cn("tag", item.tone)}>{item.name}</span>
                      <p className="text-body-sm mt-3">{item.note}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-body-sm mt-4">No vaccine is triggered by age alone in this setup.</p>
              )}
            </div>

            <div className="rounded-[var(--radius-2xl)] bg-[var(--haven-white)] p-6 shadow-[inset_0_0_0_1px_var(--color-border)]">
              <p className="text-h3">Check these before assuming you need a shot</p>
              <ul className="mt-4 space-y-3 pl-5">
                {vaccineAssessment.conditionalItems.map((item) => (
                  <li key={item.name} className="text-body list-disc">
                    <span className="font-medium text-[var(--haven-ink)]">{item.name}:</span> {item.note}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {vaccineAssessment ? (
          <div className="mt-5 rounded-[var(--radius-2xl)] bg-[var(--haven-cream)] p-5">
            <p className="text-h3">Not age-based right now</p>
            <p className="text-body-sm mt-2">
              {vaccineAssessment.notCurrentlyAgeAppropriate.join(", ")}.
            </p>
          </div>
        ) : null}
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

function getVaccineAssessment(birthDate: Date | null, examDate: Date | null, influenzaIsAvailable: boolean) {
  if (!birthDate || !examDate || birthDate.getTime() > examDate.getTime()) {
    return null;
  }

  const age = getAgeAtExam(birthDate, examDate);
  const requiredNow: Array<{ name: string; note: string; tone: VaccineTone }> = [];
  const conditionalItems: Array<{ name: string; note: string }> = [
    {
      name: "Records and titers",
      note: "Written vaccine records and acceptable lab evidence of immunity can satisfy some requirements without another dose."
    },
    {
      name: "Civil-surgeon review",
      note: "Pregnancy, contraindications, prior disease history, and dose timing can change what is actually given at the exam."
    }
  ];

  if (age.monthsTotal >= 2 && age.years < 7) {
    requiredNow.push({
      name: "DTP/DTaP/DT",
      note: "The CDC table marks pediatric diphtheria, tetanus, and pertussis vaccines as age-appropriate from 2 months through 6 years.",
      tone: "tag-active"
    });
  }

  if (age.years >= 11) {
    requiredNow.push({
      name: "Tdap/Td",
      note: "The CDC table marks adolescent and adult tetanus, diphtheria, and pertussis vaccination as age-appropriate from age 11 onward.",
      tone: "tag-active"
    });
  } else if (age.years >= 7) {
    requiredNow.push({
      name: "Tdap/Td",
      note: "Ages 7 to 10 sometimes need Tdap depending on vaccine history, so this bucket needs a catch-up review.",
      tone: "tag-pending"
    });
  }

  if (age.monthsTotal >= 2 && age.years < 18) {
    requiredNow.push({
      name: "Polio",
      note: "Polio is age-appropriate for children and teens under 18 according to the CDC table.",
      tone: "tag-active"
    });
  } else if (age.years >= 18) {
    conditionalItems.push({
      name: "Polio",
      note: "Adults may need polio vaccine if they do not have a completed primary series; CDC tells civil surgeons to check ACIP adult poliovirus notes."
    });
  }

  if (age.monthsTotal >= 12) {
    if (birthDate.getUTCFullYear() >= 1957) {
      requiredNow.push({
        name: "Measles, mumps, rubella (MMR)",
        note: "MMR is age-appropriate at 12 months and older for applicants born in 1957 or later.",
        tone: "tag-active"
      });
    } else {
      conditionalItems.push({
        name: "MMR",
        note: "The CDC table ties MMR to applicants born in 1957 or later, so a birth year before 1957 usually changes this requirement."
      });
    }

    requiredNow.push({
      name: "Varicella",
      note: "Varicella is age-appropriate at 12 months and older, although reliable disease history or immunity may satisfy it.",
      tone: "tag-active"
    });
  }

  if (age.daysTotal >= 42 && age.daysTotal < 105) {
    requiredNow.push({
      name: "Rotavirus",
      note: "Rotavirus is age-appropriate from 6 weeks, but timing is tight and depends on dose spacing.",
      tone: "tag-active"
    });
  } else if (age.daysTotal >= 105 && age.monthsTotal < 8) {
    requiredNow.push({
      name: "Rotavirus",
      note: "This age still falls inside the table range, but CDC says rotavirus should not be started at 15 weeks 0 days or older, so this depends on prior doses.",
      tone: "tag-pending"
    });
  }

  if (age.monthsTotal >= 2 && age.monthsTotal < 60) {
    requiredNow.push({
      name: "Hib",
      note: "Hib is age-appropriate from 2 through 59 months.",
      tone: "tag-active"
    });
  }

  if (age.monthsTotal >= 12 && age.years < 19) {
    requiredNow.push({
      name: "Hepatitis A",
      note: "Hepatitis A is age-appropriate from 12 months through 18 years.",
      tone: "tag-active"
    });
  }

  if (age.years < 60) {
    requiredNow.push({
      name: "Hepatitis B",
      note: "Hepatitis B is age-appropriate through 59 years old under the current CDC table.",
      tone: "tag-active"
    });
  }

  if (age.years >= 11 && age.years < 19) {
    requiredNow.push({
      name: "Meningococcal (MenACWY)",
      note: "MenACWY is age-appropriate from 11 through 18 years.",
      tone: "tag-active"
    });
  }

  if (age.monthsTotal >= 2 && age.monthsTotal < 60) {
    requiredNow.push({
      name: "Pneumococcal",
      note: "Children 2 through 59 months are assessed for pneumococcal conjugate vaccine (PCV).",
      tone: "tag-active"
    });
  } else if (age.years >= 65) {
    requiredNow.push({
      name: "Pneumococcal",
      note: "Adults 65 and older are in the CDC age-appropriate bucket for pneumococcal vaccination.",
      tone: "tag-active"
    });
  }

  if (age.monthsTotal >= 6) {
    if (influenzaIsAvailable) {
      requiredNow.push({
        name: "Influenza",
        note: "Influenza is age-appropriate annually for applicants 6 months and older when the vaccine is available in the United States.",
        tone: "tag-active"
      });
    } else {
      conditionalItems.push({
        name: "Influenza",
        note: "Influenza is usually not documented as required when vaccine is not available in the United States outside the typical flu season."
      });
    }
  }

  const seenNames = new Set(requiredNow.map((item) => item.name));
  const notCurrentlyAgeAppropriate = allVaccineNames.filter((name) => !seenNames.has(name));

  return {
    ageLabel: formatAgeLabel(age),
    ageBucket: getAgeBucket(age),
    requiredNow,
    conditionalItems,
    notCurrentlyAgeAppropriate
  };
}

function getAgeAtExam(birthDate: Date, examDate: Date) {
  const daysTotal = diffUtcDays(examDate, birthDate);

  let years = examDate.getUTCFullYear() - birthDate.getUTCFullYear();
  const examMonth = examDate.getUTCMonth();
  const birthMonth = birthDate.getUTCMonth();

  if (
    examMonth < birthMonth ||
    (examMonth === birthMonth && examDate.getUTCDate() < birthDate.getUTCDate())
  ) {
    years -= 1;
  }

  let monthsTotal =
    (examDate.getUTCFullYear() - birthDate.getUTCFullYear()) * 12 +
    (examDate.getUTCMonth() - birthDate.getUTCMonth());

  if (examDate.getUTCDate() < birthDate.getUTCDate()) {
    monthsTotal -= 1;
  }

  return {
    years,
    monthsTotal,
    daysTotal
  };
}

function formatAgeLabel(age: { years: number; monthsTotal: number; daysTotal: number }) {
  if (age.years >= 2) {
    return `${age.years} years old`;
  }

  if (age.monthsTotal >= 1) {
    return `${age.monthsTotal} month${age.monthsTotal === 1 ? "" : "s"} old`;
  }

  return `${age.daysTotal} day${age.daysTotal === 1 ? "" : "s"} old`;
}

function getAgeBucket(age: { years: number; monthsTotal: number }) {
  if (age.monthsTotal < 2) {
    return "Birth to 1 month";
  }

  if (age.monthsTotal < 12) {
    return "2 to 11 months";
  }

  if (age.years < 7) {
    return "12 months to 6 years";
  }

  if (age.years < 11) {
    return "7 to 10 years";
  }

  if (age.years < 18) {
    return "11 to 17 years";
  }

  if (age.years < 65) {
    return "18 to 64 years";
  }

  return "65 years and older";
}
