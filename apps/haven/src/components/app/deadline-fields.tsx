"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/**
 * "Your deadlines": every question is optional, and a date is asked for only
 * once the client says the matching thing applies. Used by setup step 5 and
 * the one-time prompt at /onboarding/deadlines.
 */

export type DeadlineValues = {
  statusEndDate?: string;
  statusEndUnknown?: string;
  jobEnded?: string;
  lastWorkDay?: string;
  agencyDeadlineType?: string;
  agencyDeadlineDate?: string;
  travelPlanned?: string;
  travelDate?: string;
};

type Key = keyof DeadlineValues;

function Optional() {
  return <span className="font-normal text-[var(--color-text-tertiary)]">(optional)</span>;
}

export function DeadlineFields({ values, onChange }: { values: DeadlineValues; onChange: (key: Key, value: string) => void }) {
  // Changing an answer clears the date that only made sense with it.
  const set = (key: Key, value: string, clears?: Key) => {
    onChange(key, value);
    if (clears) onChange(clears, "");
  };
  const notSure = values.statusEndUnknown === "yes";

  return (
    <div className="space-y-5">
      <div>
        <label className="field-label" htmlFor="deadline-status-end">
          When does your current status end? <Optional />
        </label>
        <p className="text-body-sm mb-2 text-[var(--color-text-secondary)]">
          The date on your I-94, or your visa or EAD end date, whichever comes first.
        </p>
        <Input
          disabled={notSure}
          id="deadline-status-end"
          onChange={(e) => set("statusEndDate", e.target.value)}
          type="date"
          value={notSure ? "" : values.statusEndDate ?? ""}
        />
        <label className="mt-2 flex items-center gap-2 text-body-sm">
          <input
            checked={notSure}
            onChange={(e) => set("statusEndUnknown", e.target.checked ? "yes" : "", e.target.checked ? "statusEndDate" : undefined)}
            type="checkbox"
          />
          Not sure
        </label>
      </div>

      <div>
        <label className="field-label" htmlFor="deadline-job-ended">
          Has your job ended, or is it about to? <Optional />
        </label>
        <Select
          id="deadline-job-ended"
          onChange={(e) => set("jobEnded", e.target.value, e.target.value === "yes" ? undefined : "lastWorkDay")}
          value={values.jobEnded ?? ""}
        >
          <option value="">Choose one</option>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </Select>
        {values.jobEnded === "yes" ? (
          <div className="mt-3">
            <label className="field-label" htmlFor="deadline-last-day">
              Last day of work (or the planned last day)
            </label>
            <Input id="deadline-last-day" onChange={(e) => set("lastWorkDay", e.target.value)} type="date" value={values.lastWorkDay ?? ""} />
          </div>
        ) : null}
      </div>

      <div>
        <label className="field-label" htmlFor="deadline-agency-type">
          Any deadline from USCIS or a consulate? <Optional />
        </label>
        <Select
          id="deadline-agency-type"
          onChange={(e) => set("agencyDeadlineType", e.target.value, e.target.value ? undefined : "agencyDeadlineDate")}
          value={values.agencyDeadlineType ?? ""}
        >
          <option value="">None</option>
          <option value="rfe">Request for evidence (RFE) response</option>
          <option value="interview">Interview</option>
          <option value="biometrics">Biometrics appointment</option>
          <option value="other">Other deadline</option>
        </Select>
        {values.agencyDeadlineType ? (
          <div className="mt-3">
            <label className="field-label" htmlFor="deadline-agency-date">
              Date
            </label>
            <Input
              id="deadline-agency-date"
              onChange={(e) => set("agencyDeadlineDate", e.target.value)}
              type="date"
              value={values.agencyDeadlineDate ?? ""}
            />
          </div>
        ) : null}
      </div>

      <div>
        <label className="field-label" htmlFor="deadline-travel">
          Planning to travel outside the US soon? <Optional />
        </label>
        <Select
          id="deadline-travel"
          onChange={(e) => set("travelPlanned", e.target.value, e.target.value === "yes" ? undefined : "travelDate")}
          value={values.travelPlanned ?? ""}
        >
          <option value="">Choose one</option>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </Select>
        {values.travelPlanned === "yes" ? (
          <div className="mt-3">
            <label className="field-label" htmlFor="deadline-travel-date">
              Departure date
            </label>
            <Input id="deadline-travel-date" onChange={(e) => set("travelDate", e.target.value)} type="date" value={values.travelDate ?? ""} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
