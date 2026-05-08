"use client";

import { useEffect } from "react";

import { consumeLoginAttempt, resetMixpanel, trackEvent } from "@/lib/mixpanel";

const FAILURE_MESSAGES = new Set(["invalid_credentials"]);

export function LoginEventTracker({ message }: { message?: string }) {
  useEffect(() => {
    resetMixpanel();

    if (!message || !FAILURE_MESSAGES.has(message)) return;

    const loginAttempt = consumeLoginAttempt();
    trackEvent("Sign In", {
      user_id: null,
      login_method: loginAttempt?.method ?? "unknown",
      success: false
    });
  }, [message]);

  return null;
}
