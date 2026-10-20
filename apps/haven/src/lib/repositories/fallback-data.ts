/**
 * What pages and the Advisor use when there is no real profile to show.
 *
 * Kept apart from both repositories so each can use it without importing the
 * other.
 */

import { havenSnapshot } from "@/lib/repositories/mock-data";
import type { HavenWorkspaceSnapshot } from "@/types/domain";

/**
 * Mock data is for local development and tests, never for a deployed build.
 *
 * `next build`/`next start` and Vercel set NODE_ENV=production, so a production
 * deploy that loses its Supabase variables does not quietly start advising a real
 * person as the demo persona. A production-mode local run that genuinely wants the
 * demo data opts in with HAVEN_ALLOW_MOCK_DATA=true.
 */
export function mockDataAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== "production" || env.HAVEN_ALLOW_MOCK_DATA === "true";
}

/**
 * A snapshot that claims nothing about the user.
 *
 * Used when the real profile could not be loaded. The enum fields have no
 * "unknown" member, so they are left as empty strings: every reader in the
 * Advisor treats an empty value as "not on file" and asks rather than assumes,
 * and the Advisor additionally swaps its profile block for an explicit
 * "profile unavailable" line when `contextSource` is "unavailable".
 */
export function unavailableSnapshot(): HavenWorkspaceSnapshot {
  const unknown = "" as never;
  return {
    communityUnreadCount: 0,
    profile: {
      id: "",
      fullName: "",
      email: "",
      visaType: unknown,
      countryOfBirth: "",
      permStage: unknown,
      i140Approved: false,
      preferenceCategory: "Not sure",
      i485Filed: false,
      employmentStatus: unknown,
      spouseVisaStatus: unknown,
      primaryGoal: "not_sure",
      topConcerns: []
    },
    activeLayoffEvent: null,
    dashboard: {
      nextActions: [],
      communityMatchesLabel: "",
      timelineHighlights: [],
      signals: { layoffReadinessScore: unknown, layoffReadinessReasoning: [] }
    },
    onboardingSteps: [],
    timelineEvents: [],
    planner: { situationSummary: "", rankedOptions: [], checklist: [], communityContext: "", disclaimer: "" },
    cohorts: [],
    warRoom: { id: "war-room-empty", type: "war_room", name: "", summary: "", members: [], posts: [] },
    documents: [],
    emailAlias: null,
    emailInbox: [],
    emailThreads: [],
    emailContacts: []
  };
}

/** True for the empty profile used when the real one could not be loaded. */
export function isProfileUnavailable(profile: Pick<HavenWorkspaceSnapshot["profile"], "id">): boolean {
  return profile.id === "";
}


/**
 * The base a real user's snapshot is built on, or what a user with no profile
 * row gets: the demo persona in development, nothing in production.
 */
export function baseSnapshot(): HavenWorkspaceSnapshot {
  return mockDataAllowed() ? havenSnapshot : unavailableSnapshot();
}

/**
 * A signed-in user who has not saved a profile yet. Their own id and email, and
 * nothing else — previously they were shown the demo persona's visa, dates and
 * employer as if those were theirs.
 */
export function emptyProfileSnapshot(user: { id: string; email?: string | null }): HavenWorkspaceSnapshot {
  if (mockDataAllowed()) return havenSnapshot;
  const empty = unavailableSnapshot();
  return { ...empty, profile: { ...empty.profile, id: user.id, email: user.email ?? "" } };
}
