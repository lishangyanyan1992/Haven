"use client";

import { useActionState, type ReactNode } from "react";
import { ArrowRight, BadgeCheck, CalendarDays, CircleAlert, DollarSign, ExternalLink, GraduationCap, MessageSquareText, PlusCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Day1CptSchool } from "@/lib/day1-cpt-schools";
import { submitDay1CptFeedback, type Day1CptFeedbackActionState } from "@/server/day1-cpt-directory-actions";

type Day1CptDirectoryProps = {
  schools: Day1CptSchool[];
};

const initialFeedbackState: Day1CptFeedbackActionState = {
  message: "",
  status: "idle"
};

function faviconUrl(domain: string) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
}

export function Day1CptDirectory({ schools }: Day1CptDirectoryProps) {
  return (
    <section className="space-y-6">
      <details className="rounded-[var(--radius-xl)] border border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] p-5">
        <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--haven-white)] text-[var(--haven-sky-ink)]">
            <PlusCircle className="h-4.5 w-4.5" />
          </span>
          <span>
            <span className="block text-h3">Don&rsquo;t see your school?</span>
            <span className="mt-1 block text-body-sm text-[var(--color-text-secondary)]">
              Suggest a school with an official Day 1 CPT page. We review every submission before it&rsquo;s listed.
            </span>
          </span>
        </summary>
        <div className="mt-5 max-w-2xl">
          <SchoolSuggestionForm />
        </div>
      </details>

      <div className="grid gap-5 xl:grid-cols-2">
        {schools.map((school) => (
          <article
            className="min-w-0 overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] shadow-[0_10px_32px_-18px_rgba(44,54,48,0.22)] transition-shadow hover:shadow-[0_16px_40px_-20px_rgba(44,54,48,0.30)]"
            id={`school-${school.id}`}
            key={school.id}
          >
            <div className="border-b border-[var(--color-border)] bg-[linear-gradient(180deg,var(--haven-cream)_0%,var(--haven-white)_100%)] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-2">
                    <img
                      alt={`${school.name} logo`}
                      className="h-9 w-9 rounded-[var(--radius-sm)] object-contain"
                      height={36}
                      src={faviconUrl(school.logoDomain)}
                      width={36}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-h2 break-words">{school.name}</h3>
                    <p className="text-caption mt-1">{school.location}</p>
                    <a
                      className="mt-2 inline-flex items-center gap-1 text-body-sm font-medium text-[var(--haven-sky-ink)] underline-offset-4 hover:underline"
                      href={school.website}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Official website
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
                <span className="tag tag-active inline-flex w-fit items-center gap-1">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Official source checked
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <Metric icon={CalendarDays} label="Closest start" value={school.nextCohort} />
                <Metric icon={ShieldCheck} label="CPT timing" value={school.cptTiming} />
                <Metric icon={DollarSign} label="Tuition" value={school.tuition} />
              </div>
            </div>

            <div className="space-y-5 p-5">
              <div className="border-l-2 border-[var(--haven-sage)] pl-4">
                <p className="text-label">Official confirmation</p>
                <p className="text-body-sm mt-1.5">{school.verification}</p>
              </div>

              <CardSection icon={GraduationCap} title="Day 1 CPT degrees">
                <BulletList items={school.degrees} />
              </CardSection>

              <CardSection icon={ShieldCheck} title="Maintain CPT status">
                <BulletList items={school.requirements} />
              </CardSection>

              {school.caveats.length ? (
                <CardSection icon={CircleAlert} title="Caveats to verify" tone="warn">
                  <BulletList items={school.caveats} tone="warn" />
                </CardSection>
              ) : null}

              <div className="border-t border-[var(--color-border)] pt-4">
                <p className="text-label">Official sources</p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {school.sources.map((source) => (
                    <a
                      className="tag tag-pending inline-flex items-center gap-1 hover:underline"
                      href={source.url}
                      key={source.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {source.label}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>

              <details className="border-t border-[var(--color-border)] pt-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-body-sm font-medium text-[var(--haven-ink)] [&::-webkit-details-marker]:hidden">
                  <MessageSquareText className="h-4 w-4" />
                  Share your experience
                </summary>
                <div className="mt-4">
                  <SchoolFeedbackForm school={school} />
                </div>
              </details>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AdvisorListingCallout() {
  return (
    <details className="rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-5">
      <summary className="flex cursor-pointer list-none items-start gap-3 [&::-webkit-details-marker]:hidden">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--haven-white)] text-[var(--haven-ink)]">
          <PlusCircle className="h-4.5 w-4.5" />
        </span>
        <span>
          <span className="block text-h3">Are you a Day 1 CPT advisor?</span>
          <span className="mt-1 block text-body-sm text-[var(--color-text-secondary)]">
            Request a listing for review. We do not publish paid endorsements.
          </span>
        </span>
      </summary>
      <div className="mt-5 max-w-2xl">
        <ConsultantListingForm />
      </div>
    </details>
  );
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-3">
      <div className="flex items-center gap-2 text-label">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-2 text-body-sm">{value}</p>
    </div>
  );
}

function CardSection({
  children,
  icon: Icon,
  title,
  tone = "default"
}: {
  children: ReactNode;
  icon: typeof GraduationCap;
  title: string;
  tone?: "default" | "warn";
}) {
  return (
    <section>
      <div className={`flex items-center gap-2 text-label ${tone === "warn" ? "text-[var(--haven-blush-ink)]" : ""}`}>
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

function BulletList({ items, tone = "default" }: { items: string[]; tone?: "default" | "warn" }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li className="grid grid-cols-[auto_1fr] gap-2 text-body-sm" key={item}>
          <span
            className={`mt-2 h-1.5 w-1.5 rounded-full ${tone === "warn" ? "bg-[var(--haven-blush)]" : "bg-[var(--haven-sage)]"}`}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Field({ children, hint, label }: { children: ReactNode; hint?: string; label: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-body-sm font-medium text-[var(--haven-ink)]">{label}</span>
      {children}
      {hint ? <span className="block text-caption">{hint}</span> : null}
    </label>
  );
}

function SchoolFeedbackForm({ school }: { school: Pick<Day1CptSchool, "id" | "name"> }) {
  const [state, formAction, pending] = useActionState(submitDay1CptFeedback, initialFeedbackState);

  if (state.status === "success") {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-4">
        <p className="text-body-sm font-medium text-[var(--haven-ink)]">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input name="feedback_kind" type="hidden" value="school_comment" />
      <input name="school_id" type="hidden" value={school.id} />

      <div className="grid gap-3">
        <Field label="Your connection">
          <Select name="relationship" defaultValue="student">
            <option value="student">Current student</option>
            <option value="alum">Alum</option>
            <option value="applicant">Applicant</option>
            <option value="school_staff">School staff</option>
            <option value="consultant">Consultant</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Email (optional)" hint="Only used if we need to verify the note.">
          <Input name="submitter_email" placeholder="you@example.com" type="email" />
        </Field>
      </div>

      <Field
        label={`What should others know about ${school.name}?`}
        hint="Do not include SEVIS IDs, case numbers, or private documents."
      >
        <Textarea
          name="comment"
          placeholder="Share CPT timing, DSO responsiveness, onsite requirement, tuition surprises, or caveats."
          required
          rows={4}
        />
      </Field>

      {state.status === "error" ? <p className="text-body-sm text-[var(--haven-blush-ink)]">{state.message}</p> : null}

      <Button disabled={pending} type="submit" variant="outline">
        {pending ? "Sending..." : "Submit note"}
      </Button>
    </form>
  );
}

function SchoolSuggestionForm() {
  const [state, formAction, pending] = useActionState(submitDay1CptFeedback, initialFeedbackState);

  if (state.status === "success") {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-4">
        <p className="text-body-sm font-medium text-[var(--haven-ink)]">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input name="feedback_kind" type="hidden" value="school_suggestion" />

      <Field label="School name">
        <Input name="school_name" placeholder="University name" required />
      </Field>
      <Field
        label="Official Day 1 CPT page or website"
        hint="Link the school's official CPT page if you have it — it speeds up review."
      >
        <Input name="school_website" placeholder="https://school.edu/day-1-cpt" required type="url" />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your connection">
          <Select name="relationship" defaultValue="student">
            <option value="student">Current student</option>
            <option value="alum">Alum</option>
            <option value="applicant">Applicant</option>
            <option value="school_staff">School staff</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Email (optional)" hint="Only used if we need to verify the suggestion.">
          <Input name="submitter_email" placeholder="you@example.com" type="email" />
        </Field>
      </div>

      <Field label="Why should we add it?" hint="Which official page mentions Day 1 CPT, qualifying degrees, timing, etc.">
        <Textarea
          name="comment"
          placeholder="Share the official CPT page, qualifying degrees, or what you know about start timing."
          required
          rows={3}
        />
      </Field>

      {state.status === "error" ? <p className="text-body-sm text-[var(--haven-blush-ink)]">{state.message}</p> : null}

      <Button disabled={pending} type="submit" variant="accent">
        {pending ? "Sending..." : "Suggest school"}
      </Button>
    </form>
  );
}

function ConsultantListingForm() {
  const [state, formAction, pending] = useActionState(submitDay1CptFeedback, initialFeedbackState);

  if (state.status === "success") {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--haven-sage-mid)] bg-[var(--haven-white)] p-4">
        <p className="text-body-sm font-medium text-[var(--haven-ink)]">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input name="feedback_kind" type="hidden" value="consultant_listing" />
      <input name="relationship" type="hidden" value="consultant" />

      <Field label="Consultancy name">
        <Input name="organization_name" placeholder="Organization name" required />
      </Field>
      <Field label="Website">
        <Input name="organization_website" placeholder="https://example.com" required type="url" />
      </Field>
      <Field label="Contact email">
        <Input name="submitter_email" placeholder="you@example.com" required type="email" />
      </Field>
      <Field label="Services offered">
        <Textarea name="services" placeholder="School matching, application support, transfer timing, scholarship help..." required rows={3} />
      </Field>
      <Field label="Review note">
        <Textarea name="comment" placeholder="Tell us why this listing should be reviewed for Haven." required rows={3} />
      </Field>

      {state.status === "error" ? <p className="text-body-sm text-[var(--haven-blush-ink)]">{state.message}</p> : null}

      <Button disabled={pending} type="submit" variant="accent">
        {pending ? "Sending..." : "Request listing"}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </form>
  );
}

