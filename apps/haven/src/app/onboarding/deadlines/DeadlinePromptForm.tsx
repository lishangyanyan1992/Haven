"use client";

import { useState } from "react";

import { DeadlineFields, type DeadlineValues } from "@/components/app/deadline-fields";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { saveDeadlinePromptAction, skipDeadlinePromptAction } from "@/server/deadline-actions";

export function DeadlinePromptForm({ initial }: { initial: DeadlineValues }) {
  const [values, setValues] = useState<DeadlineValues>(initial);
  const keys = Object.keys({
    statusEndDate: 1,
    statusEndUnknown: 1,
    jobEnded: 1,
    lastWorkDay: 1,
    agencyDeadlineType: 1,
    agencyDeadlineDate: 1,
    travelPlanned: 1,
    travelDate: 1
  }) as (keyof DeadlineValues)[];

  return (
    <div className="mt-6">
      <form action={saveDeadlinePromptAction} className="space-y-6">
        <DeadlineFields onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))} values={values} />
        {/* Every field is sent, so a blank one clears what was there. */}
        {keys.map((key) => (
          <input key={key} name={key} type="hidden" value={values[key] ?? ""} />
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Buttons />
        </div>
      </form>
    </div>
  );
}

function Buttons() {
  const { pending } = useFormStatus();
  return (
    <>
      <Button disabled={pending} formAction={skipDeadlinePromptAction} formNoValidate type="submit" variant="outline">
        Skip for now
      </Button>
      <Button disabled={pending} type="submit">
        {pending ? "Saving..." : "Save"}
      </Button>
    </>
  );
}
