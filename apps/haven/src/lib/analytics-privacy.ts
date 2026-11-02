/**
 * Analytics gets a coded user id (Haven's internal id, never a name or email)
 * and a cleaned page path. Never names, emails, immigration details, what
 * people type, full URLs (invite links and sign-up claim codes live in URLs),
 * record ids, or marketing first-touch data. Client data stays in Haven.
 */
export const BLOCKED_PROPERTIES = [
  "$current_url",
  "$pathname",
  "$el_attr__href",
  "$el_id",
  "current_url_search",
  "current_url_path",
  "current_page_title",
  "$referrer",
  "$referring_domain",
  "$initial_referrer",
  "$initial_referring_domain",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "utm_id",
  "initial_utm_source",
  "initial_utm_medium",
  "initial_utm_campaign",
  "initial_utm_content",
  "initial_utm_term",
  "initial_utm_id",
  "visa_type",
  "country_of_birth",
  "employment_status",
  "primary_goal",
  "email",
  "$email",
  "$name"
] as const;

export const LEGACY_SUPER_PROPERTIES = ["visa_type", "country_of_birth"] as const;

/**
 * Routes whose dynamic segment identifies a person, a record or an invite.
 * The segment after the prefix is always replaced, whatever it looks like.
 */
const PRIVATE_ROUTES: Array<{ prefix: string[]; placeholder: string }> = [
  { prefix: ["i"], placeholder: ":token" },
  { prefix: ["invite"], placeholder: ":token" },
  { prefix: ["firm", "clients"], placeholder: ":id" },
  { prefix: ["admin", "community-imports"], placeholder: ":id" },
  { prefix: ["api", "advisor", "threads"], placeholder: ":id" }
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A readable page slug such as "h1b-layoff-guide". Anything else is not kept. */
const SLUG = /^[a-z0-9][a-z0-9._-]*$/i;

function looksLikeId(segment: string): boolean {
  return (
    UUID.test(segment) ||
    // Random tokens are mixed-case, or one long run with digits and no hyphens.
    // Lowercase words joined by hyphens ("dhs-60-day-grace-period-2026") are slugs.
    (segment.length >= 16 &&
      /^[A-Za-z0-9_-]+$/.test(segment) &&
      /\d/.test(segment) &&
      ((/[A-Z]/.test(segment) && /[a-z]/.test(segment)) || !segment.includes("-"))) ||
    /^\d+$/.test(segment)
  );
}

/**
 * Pathname only, e.g. /i/:token, /firm/clients/:id. Private route segments
 * are always replaced; elsewhere, ids become :id and anything that is not a
 * plain slug (an email, an encoded value) becomes :redacted.
 */
export function sanitizePath(pathname: string): string {
  const raw = pathname.split("?")[0].split("#")[0];
  const segments = raw.split("/").map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
  const named = segments.filter(Boolean);

  return segments
    .map((segment, index) => {
      if (!segment) return segment;
      const position = segments.slice(0, index).filter(Boolean).length;
      for (const route of PRIVATE_ROUTES) {
        const matches =
          position === route.prefix.length && route.prefix.every((part, i) => named[i] === part);
        if (matches) return route.placeholder;
      }
      if (looksLikeId(segment)) return ":id";
      return SLUG.test(segment) ? segment : ":redacted";
    })
    .join("/");
}

/** Element attributes autocapture must not record. Link addresses can carry invite tokens. */
export const BLOCKED_ELEMENT_ATTRIBUTES = ["href", "value", "title", "alt", "aria-label", "placeholder"] as const;

/**
 * Autocapture sends every element's DOM id, and that cannot be filtered per
 * attribute. Ids such as report-note-<traceId> or firm-<uuid> carry record
 * ids, so an interaction inside any element with one is not tracked at all.
 */
export function hasRecordLikeId(element: { id?: unknown }): boolean {
  const id = typeof element.id === "string" ? element.id : "";
  if (!id) return false;
  return /[0-9a-f]{8}-[0-9a-f]{4}-/i.test(id) || /\d{4,}/.test(id) || /[A-Za-z0-9]{16,}/.test(id) || id.includes("@");
}
