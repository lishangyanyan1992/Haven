"use client";

import { useActionState } from "react";

import { submitCaseContribution, type ContributionActionState } from "@/server/community-contribution-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState: ContributionActionState = { status: "idle", message: "" };

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-[var(--color-text-tertiary)]">{hint}</span> : null}
    </label>
  );
}

export function ContributionForm() {
  const [state, formAction, pending] = useActionState(submitCaseContribution, initialState);

  if (state.status === "success") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-mid)] bg-[var(--haven-white)] p-6 text-center">
        <p className="text-base font-medium text-[var(--color-text-primary)]">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Share your path to help others in your exact situation. Everything is aggregated and anonymous — you’re
        never identified. Takes about a minute.
      </p>

      {/* Tier 1 — required */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-[var(--color-text-primary)]">The essentials</legend>

        <Field label="Your current visa status">
          <Select name="current_status" required defaultValue="">
            <option value="" disabled>Select…</option>
            <option value="h1b">H-1B</option>
            <option value="f1_opt">F-1 (OPT)</option>
            <option value="l1">L-1</option>
            <option value="other">Other</option>
          </Select>
        </Field>

        <Field label="Where are you in the green card process?">
          <Select name="green_card_stage" defaultValue="">
            <option value="">Not sure / prefer not to say</option>
            <option value="none">Not started</option>
            <option value="perm">PERM</option>
            <option value="i140_pending">I-140 pending</option>
            <option value="i140_approved">I-140 approved</option>
            <option value="i485_filed">I-485 filed</option>
          </Select>
        </Field>

        <Field label="What did you do after your job ended?">
          <Select name="path_taken" required defaultValue="">
            <option value="" disabled>Select…</option>
            <option value="h1b_transfer">Transferred H-1B to a new employer</option>
            <option value="h4_cos">Filed for H-4</option>
            <option value="b2_cos">Filed a B-2 (visitor) bridge</option>
            <option value="o1">Pursued an O-1</option>
            <option value="consular">Consular processing</option>
            <option value="departed">Left the US</option>
            <option value="day1_cpt">Day-1 CPT</option>
            <option value="undecided">Still deciding</option>
          </Select>
        </Field>

        <Field label="What was the outcome?">
          <Select name="outcome" defaultValue="">
            <option value="">Still deciding / N/A</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="rfe">Got an RFE</option>
            <option value="noid">Got a NOID</option>
            <option value="pending">Still pending</option>
          </Select>
        </Field>
      </fieldset>

      {/* Tier 2 — optional */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-[var(--color-text-primary)]">
          Optional — the more you share, the more it helps others
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country of birth">
            <Select name="nationality_bucket" defaultValue="">
              <option value="">Prefer not to say</option>
              <option value="india">India</option>
              <option value="china">China</option>
              <option value="row">Other</option>
            </Select>
          </Field>

          <Field label="Preference category">
            <Select name="category" defaultValue="">
              <option value="">Not sure</option>
              <option value="eb1">EB-1</option>
              <option value="eb2">EB-2</option>
              <option value="eb3">EB-3</option>
            </Select>
          </Field>

          <Field label="What triggered this?">
            <Select name="trigger" defaultValue="">
              <option value="">Prefer not to say</option>
              <option value="laid_off">Laid off</option>
              <option value="quit">Quit</option>
              <option value="opt_ending">OPT ending</option>
              <option value="other">Other</option>
            </Select>
          </Field>

          <Field label="Last working day" hint="Used only to estimate your grace window.">
            <Input type="date" name="last_working_day" />
          </Field>

          <Field label="Date you filed">
            <Input type="date" name="filed_date" />
          </Field>

          <Field label="Date of decision">
            <Input type="date" name="decision_date" />
          </Field>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input type="checkbox" name="premium_processing" /> Premium processing
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input type="checkbox" name="got_rfe" /> Hit an RFE along the way
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input type="checkbox" name="got_noid" /> Hit a NOID along the way
          </label>
        </div>

        <Field label="Anything you’d tell someone in your situation?" hint="Shown anonymously as a note; never turned into a statistic.">
          <Textarea name="notes" rows={3} />
        </Field>
      </fieldset>

      <label className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
        <input type="checkbox" name="consent" className="mt-1" required />
        <span>I agree to share this anonymized information with the Haven community. I understand it will be aggregated and shown to others in similar situations.</span>
      </label>

      {state.status === "error" ? (
        <p className="text-sm text-[var(--color-danger,#b91c1c)]">{state.message}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Sharing…" : "Share my path"}
      </Button>
    </form>
  );
}
