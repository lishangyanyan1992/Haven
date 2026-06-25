// Shared option lists for the firm claim / apply form. Kept server- and
// client-safe (no "use client") so the form and the server action can both
// validate against the same canonical values.

export const VISA_TYPES = [
  "H-1B",
  "H-1B transfer",
  "O-1",
  "EB-1A",
  "EB-2 NIW",
  "PERM",
  "L-1",
  "TN",
  "STEM OPT / cap-gap",
  "Change of status",
  "Green card (family)",
  "Asylum"
] as const;

export const HARD_CASES = [
  "RFE responses",
  "Denials & appeals",
  "Layoff grace period",
  "Consular processing",
  "Port-of-entry issues",
  "Premium processing"
] as const;

export const LANGUAGES = [
  "Spanish",
  "Mandarin",
  "Cantonese",
  "Hindi",
  "Telugu",
  "Korean",
  "Vietnamese",
  "Portuguese",
  "Russian",
  "French",
  "Japanese",
  "Tagalog",
  "Arabic"
] as const;

export const PRICING_STRUCTURES = ["Flat fee", "Hourly", "Mixed"] as const;
export const CONSULTATION_TYPES = ["Free", "Paid"] as const;

// US state / territory codes for the bar-state and firm-location selects.
export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
] as const;
