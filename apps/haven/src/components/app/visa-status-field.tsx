"use client";

import { useState } from "react";

import { VisaSelector } from "@/app/onboarding/VisaSelector";
import { ALL_VISA_OPTIONS } from "@/lib/visas";

/**
 * Every visa and status, searchable, with a write-in for anything unlisted.
 * For plain forms: posts `visaType` (the status itself, including a typed-in
 * one) and `customVisaDetail` (the typed-in text, or empty).
 */
export function VisaStatusField({ defaultValue, defaultCustom }: { defaultValue?: string; defaultCustom?: string }) {
  const known = ALL_VISA_OPTIONS.some((o) => o.value !== "other" && o.value.toLowerCase() === (defaultValue ?? "").toLowerCase());
  // A saved write-in comes back as its own text; show it as "Other" with that text.
  const [value, setValue] = useState(defaultValue && !known ? "other" : defaultValue ?? "");
  const [custom, setCustom] = useState(defaultValue && !known ? defaultCustom || defaultValue : defaultCustom ?? "");
  const effective = value === "other" ? custom.trim() : value;

  return (
    <div>
      <VisaSelector
        customValue={custom}
        onChange={(next, typed) => {
          setValue(next);
          if (next === "other") setCustom(typed ?? "");
        }}
        value={value}
      />
      <input name="visaType" type="hidden" value={effective} />
      <input name="customVisaDetail" type="hidden" value={value === "other" ? custom.trim() : ""} />
    </div>
  );
}
