"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { initMixpanel, trackEvent } from "@/lib/mixpanel";

export function MixpanelProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initMixpanel();
  }, []);

  useEffect(() => {
    trackEvent("Page View", {
      page_url: window.location.href,
      page_title: document.title
    });
  }, [pathname, searchParams]);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      trackEvent("Error", {
        error_type: "client",
        error_message: event.message,
        error_code: null,
        page_url: window.location.href
      });
    };

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  return null;
}
