"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { initMixpanel, sanitizePath, trackEvent, trackPageView } from "@/lib/mixpanel";

export function MixpanelProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initMixpanel();
  }, []);

  useEffect(() => {
    // Path only, ids and tokens removed. Full URLs can carry invite tokens and
    // sign-up claim codes, and titles can carry names.
    trackPageView(window.location.pathname);
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      trackEvent("Error", {
        error_type: "client",
        error_message: event.message,
        error_code: null,
        page_path: sanitizePath(window.location.pathname)
      });
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  return null;
}
