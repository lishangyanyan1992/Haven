"use client";

import { useEffect, useRef } from "react";

import { consumeLoginAttempt, consumeSignUpAttempt, identifyUser, trackEvent } from "@/lib/mixpanel";

interface MixpanelAuthTrackerProps {
  userId: string;
}

/**
 * Tells analytics which anonymous user this is. Only Haven's internal id is
 * sent: no name, email or immigration details (see lib/mixpanel.ts).
 */
export function MixpanelAuthTracker({ userId }: MixpanelAuthTrackerProps) {
  const identified = useRef(false);

  // Identify the user exactly once per mount — not on every navigation.
  useEffect(() => {
    if (identified.current) return;
    identified.current = true;

    identifyUser(userId);

    // Consume one-time login / signup events stored in sessionStorage.
    // consumeX() removes the entry after reading — safe to call every mount.
    const signUpAttempt = consumeSignUpAttempt();
    if (signUpAttempt) {
      trackEvent("Sign Up", {
        user_id: userId,
        signup_method: "email",
      });
    }

    const loginAttempt = consumeLoginAttempt();
    if (loginAttempt) {
      trackEvent("Sign In", {
        user_id: userId,
        login_method: loginAttempt.method,
        success: true,
      });
    }
  }, [userId]);

  return null;
}
