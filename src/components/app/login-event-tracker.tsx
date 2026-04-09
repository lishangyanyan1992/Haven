"use client";

import { useEffect } from "react";

import { consumeLoginAttempt, resetMixpanel, trackEvent } from "@/lib/mixpanel";

const FAILURE_MESSAGES = new Set(["invalid_credentials", "oauth_error"]);

export function LoginEventTracker({ message }: { message?: string }) {
  useEffect(() => {
    resetMixpanel();

    if (!message || !FAILURE_MESSAGES.has(message)) return;

    const loginAttempt = consumeLoginAttempt();
    trackEvent("Login Failed", {
      method: loginAttempt?.method ?? "unknown",
      reason: message
    });
  }, [message]);

  return null;
}
