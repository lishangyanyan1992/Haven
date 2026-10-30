"use client";

import { useState } from "react";

import { VisaSelector } from "@/app/onboarding/VisaSelector";
import { ALL_VISA_OPTIONS, standardVisaValue } from "@/lib/visas";

/**
 * Every visa and status, searchable, with a write-in for anything unlisted.
 * For plain forms: posts `visaType` (the status itself, including a typed-in
 * one) and `customVisaDetail` (the typed-in text, or empty).
 */
export function VisaStatusField({
  defaultValue,
  defaultCustom,
  label = "Current visa status"
}: {
  defaultValue?: string;
  defaultCustom?: string;
  label?: string;
}) {
  const known = ALL_VISA_OPTIONS.some((o) => o.value !== "other" && o.value.toLowerCase() === (defaultValue ?? "").toLowerCase());
  // A saved write-in comes back as its own text; show it as "Other" with that text.
  const [value, setValue] = useState(defaultValue && !known ? "other" : defaultValue ?? "");
  const [custom, setCustom] = useState(defaultValue && !known ? defaultCustom || defaultValue : defaultCustom ?? "");
  const typed = custom.trim();
  // A typed-in name that matches a listed status is saved as that status ("citizen" → "Citizen").
  const listed =
    ALL_VISA_OPTIONS.find((o) => o.value !== "other" && o.value.toLowerCase() === typed.toLowerCase())?.value ??
    standardVisaValue(typed);
  const effective = value === "other" ? listed ?? typed : value;

  return (
    <div>
      <VisaSelector
        ariaLabel={label}
        customValue={custom}
        onChange={(next, typed) => {
          setValue(next);
          if (next === "other") setCustom(typed ?? "");
        }}
        value={value}
      />
      <input name="visaType" type="hidden" value={effective} />
      <input name="customVisaDetail" type="hidden" value={value === "other" && !listed ? typed : ""} />
    </div>
  );
}
