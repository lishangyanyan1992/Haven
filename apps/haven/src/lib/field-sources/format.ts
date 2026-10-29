const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "2021-06-14" → "Jun 14, 2021"; anything else as it is; empty → "(empty)". */
export function formatSourceValue(value: string | null) {
  if (!value) return "(empty)";
  if (!ISO_DATE.test(value)) return value;
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}
