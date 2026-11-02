"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { sanitizePath } from "@/lib/analytics-privacy";

/** Keep the origin, drop the query string and replace ids and tokens in the path. */
function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${sanitizePath(parsed.pathname)}`;
  } catch {
    return sanitizePath(url);
  }
}

/**
 * Vercel Analytics and Speed Insights with cleaned URLs. Full URLs can carry
 * invite tokens and sign-up claim codes (see lib/analytics-privacy.ts).
 */
export function VercelInsights() {
  return (
    <>
      <Analytics beforeSend={(event) => ({ ...event, url: cleanUrl(event.url) })} />
      <SpeedInsights beforeSend={(data) => ({ ...data, url: cleanUrl(data.url) })} />
    </>
  );
}
