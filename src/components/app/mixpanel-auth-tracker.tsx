"use client";

import { useEffect } from "react";

import { consumeLoginAttempt, identifyUser, trackEvent } from "@/lib/mixpanel";

export function MixpanelAuthTracker({
  destination,
  userId
}: {
  destination: string;
  userId: string;
}) {
  useEffect(() => {
    identifyUser(userId);

    const loginAttempt = consumeLoginAttempt();
    if (!loginAttempt) return;

    trackEvent("Login Succeeded", {
      destination,
      duration_ms: Math.max(Date.now() - loginAttempt.startedAt, 0),
      method: loginAttempt.method
    });
  }, [destination, userId]);

  return null;
}
