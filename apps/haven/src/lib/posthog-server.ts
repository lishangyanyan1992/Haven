import "server-only";

import { PostHog } from "posthog-node";

import { env } from "@/lib/env";

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

export async function captureSignupCompleted(userId: string) {
  const projectToken = env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  if (!projectToken) return;

  const posthog = new PostHog(projectToken, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0
  });

  try {
    posthog.capture({
      distinctId: userId,
      event: "signup_completed",
      properties: {
        signup_method: "email"
      }
    });
    await posthog.shutdown();
  } catch (error) {
    // Analytics must never prevent a successfully created account from continuing.
    console.error("[posthog] failed to capture signup_completed", error);
  }
}
