/**
 * Analytics gets an anonymous user id and a cleaned page path. Never names,
 * emails, immigration details, what people type, or full URLs (invite links
 * and sign-up claim codes live in URLs). Client data stays in Haven.
 */
export const BLOCKED_PROPERTIES = [
  "$current_url",
  "$pathname",
  "$el_attr__href",
  "current_url_search",
  "current_url_path",
  "current_page_title",
  "$referrer",
  "$referring_domain",
  "$initial_referrer",
  "$initial_referring_domain",
  "visa_type",
  "country_of_birth",
  "employment_status",
  "primary_goal",
  "email",
  "$email",
  "$name"
] as const;

export const LEGACY_SUPER_PROPERTIES = ["visa_type", "country_of_birth"] as const;

/** Pathname only, with ids and tokens replaced, e.g. /i/:token, /firm/clients/:id. */
export function sanitizePath(pathname: string): string {
  const segments = pathname.split("?")[0].split("#")[0].split("/");
  return segments
    .map((segment, index) => {
      if (!segment) return segment;
      if (segments[index - 1] === "i") return ":token";
      const looksLikeId =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) ||
        (segment.length >= 16 && /^[A-Za-z0-9_-]+$/.test(segment) && /\d/.test(segment)) ||
        /^\d+$/.test(segment);
      return looksLikeId ? ":id" : segment;
    })
    .join("/");
}

/** Element attributes autocapture must not record. Link addresses can carry invite tokens. */
export const BLOCKED_ELEMENT_ATTRIBUTES = ["href", "value", "title", "alt", "aria-label", "placeholder"] as const;
