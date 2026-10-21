"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Reading finishes in the background after upload, and nothing pushes the new
 * status to an open page. While any document is still being read, re-fetch the
 * page every few seconds; stop as soon as none is.
 */
export function RefreshWhileReading({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [active, router]);
  return null;
}
