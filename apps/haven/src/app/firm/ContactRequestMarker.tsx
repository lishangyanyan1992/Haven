import Link from "next/link";
import { PhoneCall } from "lucide-react";

/** "2h ago" — the age of the request is the part a lawyer acts on. */
function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/**
 * The client asked, from the advisor, to be contacted (specs/firm-contact-requests).
 *
 * Shown beside the person's urgency, never instead of it: the ranking is the
 * dates', and someone asking does not outrank someone whose deadline is close.
 * Links to the client page, where the request itself can be read and handled.
 */
export function ContactRequestMarker({ firmClientId, sentAt }: { firmClientId: string; sentAt: string }) {
  return (
    <Link
      className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--haven-sky-light)] px-2.5 py-0.5 text-[12px] font-medium text-[var(--haven-ink)] hover:underline"
      href={`/firm/clients/${firmClientId}#contact-request`}
    >
      <PhoneCall className="h-3 w-3" />
      Asked to be contacted, {timeAgo(sentAt)}
    </Link>
  );
}
