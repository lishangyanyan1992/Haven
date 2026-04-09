"use client";

import { useEffect } from "react";

import { consumeLoginAttempt, consumeSignUpAttempt, identifyUser, trackEvent } from "@/lib/mixpanel";

export function MixpanelAuthTracker({
  destination,
  email,
  userId
}: {
  destination: string;
  email: string;
  userId: string;
}) {
  useEffect(() => {
    identifyUser(userId, {
      email
    });

    const signUpAttempt = consumeSignUpAttempt();
    if (signUpAttempt) {
      trackEvent("Sign Up", {
        user_id: userId,
        email,
        signup_method: "email",
        utm_source: null,
        utm_medium: null,
        utm_campaign: null
      });
    }

    const loginAttempt = consumeLoginAttempt();
    if (!loginAttempt) return;

    trackEvent("Sign In", {
      user_id: userId,
      login_method: loginAttempt.method,
      success: true
    });
  }, [destination, email, userId]);

  return null;
}
