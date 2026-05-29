"use client";

import { useEffect, useRef } from "react";

import { consumeLoginAttempt, consumeSignUpAttempt, identifyUser, trackEvent } from "@/lib/mixpanel";

interface MixpanelAuthTrackerProps {
  userId: string;
  email: string;
  fullName?: string;
  visaType?: string;
  countryOfBirth?: string;
  employmentStatus?: string;
  primaryGoal?: string;
}

export function MixpanelAuthTracker({
  userId,
  email,
  fullName,
  visaType,
  countryOfBirth,
  employmentStatus,
  primaryGoal,
}: MixpanelAuthTrackerProps) {
  const identified = useRef(false);

  // Identify the user exactly once per mount — not on every navigation.
  useEffect(() => {
    if (identified.current) return;
    identified.current = true;

    identifyUser(userId, {
      email,
      $name: fullName ?? undefined,
      visa_type: visaType,
      country_of_birth: countryOfBirth,
      employment_status: employmentStatus,
      primary_goal: primaryGoal,
    });

    // Consume one-time login / signup events stored in sessionStorage.
    // consumeX() removes the entry after reading — safe to call every mount.
    const signUpAttempt = consumeSignUpAttempt();
    if (signUpAttempt) {
      trackEvent("Sign Up", {
        user_id: userId,
        email,
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
  }, [userId, email, fullName, visaType, countryOfBirth, employmentStatus, primaryGoal]);

  return null;
}
