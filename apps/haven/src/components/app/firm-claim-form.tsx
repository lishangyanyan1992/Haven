"use client";

import { useActionState, type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

import { submitFirmClaim, type FirmClaimActionState } from "@/server/legal-claim-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CONSULTATION_TYPES,
  HARD_CASES,
  LANGUAGES,
  PRICING_STRUCTURES,
  US_STATES,
  VISA_TYPES
} from "@/lib/legal-claim-options";

type FirmClaimFormProps = {
  mode: "claim" | "apply";
  firmId?: string;
  firmName?: string;
};

const initialState: FirmClaimActionState = { message: "", status: "idle" };

function Field({ children, hint, label }: { children: ReactNode; hint?: string; label: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-body-sm font-medium text-[var(--haven-ink)]">{label}</span>
      {children}
      {hint ? <span className="block text-caption">{hint}</span> : null}
    </label>
  );
}

function Section({ children, title, note }: { children: ReactNode; title: string; note?: string }) {
  return (
    <fieldset className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5">
      <legend className="px-1 text-label">{title}</legend>
      {note ? <p className="text-caption">{note}</p> : null}
      {children}
    </fieldset>
  );
}

function CheckboxGroup({ name, options }: { name: string; options: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <label
          key={option}
          className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-body-sm has-[:checked]:border-[var(--haven-sage)] has-[:checked]:bg-[var(--haven-sage-light)]"
        >
          <input className="accent-[var(--haven-sage)]" name={name} type="checkbox" value={option} />
          {option}
        </label>
      ))}
    </div>
  );
}

function StateSelect({ name, defaultValue }: { name: string; defaultValue?: string }) {
  return (
    <Select defaultValue={defaultValue ?? ""} name={name}>
      <option value="">Select state…</option>
      {US_STATES.map((state) => (
        <option key={state} value={state}>
          {state}
        </option>
      ))}
    </Select>
  );
}

export function FirmClaimForm({ firmId, firmName, mode }: FirmClaimFormProps) {
  const [state, formAction, pending] = useActionState(submitFirmClaim, initialState);
  const isApply = mode === "apply";

  if (state.status === "success") {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--haven-sage-strong)]" />
          <div>
            <p className="text-h3">Submitted</p>
            <p className="text-body-sm mt-1">{state.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="claim_type" type="hidden" value={mode} />
      {firmId ? <input name="firm_id" type="hidden" value={firmId} /> : null}
      {firmName && !isApply ? <input name="firm_name" type="hidden" value={firmName} /> : null}

      <Section title="About you" note="Only used to reach you about this submission — not shown publicly.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your name">
            <Input name="claimant_name" placeholder="Jane Doe" />
          </Field>
          <Field label="Your role">
            <Input name="claimant_role" placeholder="Managing attorney" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Work email" hint="Use your firm-domain email if you have one — it speeds up review.">
            <Input name="claimant_email" placeholder="you@yourfirm.com" required type="email" />
          </Field>
          <Field label="Phone (optional)">
            <Input name="claimant_phone" placeholder="(415) 555-0100" type="tel" />
          </Field>
        </div>
      </Section>

      {isApply ? (
        <Section title="Your firm" note="Listing is always free.">
          <Field label="Firm name">
            <Input name="firm_name" placeholder="Your Immigration Law Firm" required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="City">
              <Input name="city" placeholder="San Francisco" />
            </Field>
            <Field label="State">
              <StateSelect name="state" />
            </Field>
          </div>
        </Section>
      ) : null}

      <Section
        title="Evidence (links)"
        note="Public links so people can verify you. We don't independently verify — these let visitors check for themselves."
      >
        <Field label={isApply ? "Firm website" : "Firm website"} hint={isApply ? "Required." : "Your firm's homepage."}>
          <Input name="evidence_website" placeholder="https://yourfirm.com" required={isApply} type="url" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="State bar profile URL">
            <Input name="evidence_bar_url" placeholder="https://apps.calbar.ca.gov/…" type="url" />
          </Field>
          <Field label="AILA profile URL">
            <Input name="evidence_aila_url" placeholder="https://ailalawyer.com/…" type="url" />
          </Field>
        </div>
        <Field label="Certified Specialist page (optional)">
          <Input name="evidence_specialist_url" placeholder="https://…" type="url" />
        </Field>
      </Section>

      <Section title="Credentials">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Bar number">
            <Input name="bar_number" placeholder="123456" />
          </Field>
          <Field label="Bar state">
            <StateSelect name="bar_state" />
          </Field>
          <Field label="Years in practice">
            <Input name="years_in_practice" placeholder="12" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-body-sm">
            <input className="accent-[var(--haven-sage)]" name="aila_member" type="checkbox" /> AILA member
          </label>
          <label className="inline-flex items-center gap-2 text-body-sm">
            <input className="accent-[var(--haven-sage)]" name="certified_specialist" type="checkbox" /> Certified
            Specialist in Immigration Law
          </label>
        </div>
        <Field label="Certified Specialist state (if applicable)">
          <StateSelect name="certified_specialist_state" />
        </Field>
      </Section>

      <Section title="What you handle">
        <Field label="Visa & case types">
          <CheckboxGroup name="visa_types" options={VISA_TYPES} />
        </Field>
        <Field label="Harder situations you take">
          <CheckboxGroup name="hard_cases" options={HARD_CASES} />
        </Field>
        <Field label="Languages your team speaks (besides English)">
          <CheckboxGroup name="languages" options={LANGUAGES} />
        </Field>
      </Section>

      <Section title="Pricing & access" note="Transparency here is one of the biggest trust signals for newcomers.">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fee structure">
            <Select defaultValue="" name="pricing_structure">
              <option value="">Prefer not to say</option>
              {PRICING_STRUCTURES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Consultation">
            <Select defaultValue="" name="consultation">
              <option value="">Prefer not to say</option>
              {CONSULTATION_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Consultation fee (if paid)">
            <Input name="consultation_fee" placeholder="$150" />
          </Field>
          <Field label="Typical fee range (optional)">
            <Input name="fee_range" placeholder="$2,500–$6,000 for H-1B" />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Booking link (optional)">
            <Input name="booking_url" placeholder="https://calendly.com/…" type="url" />
          </Field>
          <label className="mt-7 inline-flex items-center gap-2 text-body-sm">
            <input className="accent-[var(--haven-sage)]" name="virtual_availability" type="checkbox" /> Available
            virtually nationwide
          </label>
        </div>
      </Section>

      <Section title="About the firm">
        <Field label="Short intro" hint="A couple of sentences in your own voice. No success rates or guarantees, please.">
          <Textarea name="bio" placeholder="Who you help and how you work." rows={4} />
        </Field>
      </Section>

      <label className="flex items-start gap-2 text-body-sm">
        <input className="mt-0.5 accent-[var(--haven-sage)]" name="attested" required type="checkbox" />
        <span>
          I&rsquo;m authorized to represent this firm and the information I&rsquo;ve provided is accurate.
        </span>
      </label>

      {state.status === "error" ? (
        <p className="text-body-sm text-[var(--haven-blush-ink)]">{state.message}</p>
      ) : null}

      <Button disabled={pending} type="submit" variant="accent">
        {pending ? "Submitting…" : isApply ? "Submit listing request" : "Submit claim"}
      </Button>
    </form>
  );
}
