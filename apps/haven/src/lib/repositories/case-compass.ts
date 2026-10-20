import { cache } from "react";

import { hasSupabaseEnv } from "@/lib/env";
import { havenSnapshot } from "@/lib/repositories/mock-data";
import { isProfileUnavailable, mockDataAllowed, unavailableSnapshot } from "@/lib/repositories/fallback-data";
import { resolveTestPersona } from "@/lib/repositories/test-personas";
import {
  getSupabaseCommunityPageData,
  getSupabaseDashboardPageData,
  getSupabaseInboxPageData,
  markSupabaseCommunitySeen,
  getSupabasePlannerPageData,
  getSupabasePublicCommunityPageData,
  getSupabaseShellSnapshot,
  getSupabaseTimelinePageData,
  getSupabaseWarRoomPageData,
  supabaseHavenRepository
} from "@/lib/repositories/supabase-case-compass";
import type { HavenWorkspaceSnapshot, PriorityDateIntelligence } from "@/types/domain";

export type AppShellSnapshot = Pick<HavenWorkspaceSnapshot, "communityUnreadCount" | "profile" | "dashboard">;
export type DashboardPageData = AppShellSnapshot & { priorityDateIntelligence: PriorityDateIntelligence | null };
export type TimelinePageData = AppShellSnapshot & Pick<HavenWorkspaceSnapshot, "timelineEvents">;
export type PlannerPageData = AppShellSnapshot & Pick<HavenWorkspaceSnapshot, "planner">;
export type CommunityPageData = AppShellSnapshot & Pick<HavenWorkspaceSnapshot, "cohorts">;
export type PublicCommunityPageData = Pick<HavenWorkspaceSnapshot, "cohorts" | "warRoom">;
export type WarRoomPageData = AppShellSnapshot & Pick<HavenWorkspaceSnapshot, "warRoom">;
export type InboxPageData = AppShellSnapshot &
  Pick<HavenWorkspaceSnapshot, "documents" | "emailAlias" | "emailInbox" | "emailThreads" | "emailContacts">;

/**
 * The snapshot used when there is no Supabase — Priya by default, or a test
 * persona when one is selected.
 *
 * Every mock read in this file goes through here rather than touching
 * `havenSnapshot` directly, so a persona cannot be applied to the Advisor but
 * missed by the dashboard the user is comparing it against. A half-applied
 * persona would be worse than none: the answer and the screen would describe
 * two different people.
 */
function demoSnapshot(): HavenWorkspaceSnapshot {
  return resolveTestPersona()?.snapshot ?? havenSnapshot;
}

/**
 * What every page shows when it has no real data: the demo persona in local
 * development, and an empty profile in production.
 *
 * Production used to fall back to the demo persona too, on a failed load or a
 * missing Supabase config. A real user then saw "Good to see you, Priya" with
 * someone else's visa, dates and employer, could export that as their data, and
 * was identified to analytics as the demo user.
 */
function mockSnapshot(): HavenWorkspaceSnapshot {
  return mockDataAllowed() ? demoSnapshot() : unavailableSnapshot();
}

function shellFromMock(): AppShellSnapshot {
  return {
    communityUnreadCount: 0,
    profile: mockSnapshot().profile,
    dashboard: mockSnapshot().dashboard
  };
}

/** Where the Advisor's picture of the user came from. Recorded on every trace. */
export { isProfileUnavailable, mockDataAllowed, unavailableSnapshot };

export type ProfileContextSource = "profile" | "unavailable" | "mock";

export interface SnapshotWithSource {
  snapshot: HavenWorkspaceSnapshot;
  contextSource: ProfileContextSource;
}



/**
 * The Advisor's snapshot, with where it came from.
 *
 * Separate from `getSnapshot` because the Advisor turns this into immigration
 * guidance: a failed profile read must produce no personal context at all, never
 * the demo persona's dates and employer presented as the user's own. Takes its
 * loaders as arguments so the failure path can be tested without a database.
 */
export async function loadSnapshotWithSource(
  deps: {
    hasSupabase?: boolean;
    loadProfile?: () => Promise<HavenWorkspaceSnapshot>;
    allowMock?: boolean;
    onError?: (error: unknown) => void;
  } = {}
): Promise<SnapshotWithSource> {
  const hasSupabase = deps.hasSupabase ?? hasSupabaseEnv;
  const loadProfile = deps.loadProfile ?? (() => supabaseHavenRepository.getSnapshot());
  const allowMock = deps.allowMock ?? mockDataAllowed();

  if (hasSupabase) {
    try {
      return { snapshot: await loadProfile(), contextSource: "profile" };
    } catch (error) {
      (deps.onError ?? ((err) => console.error("[advisor] profile load failed; answering without profile context", err)))(error);
      return { snapshot: unavailableSnapshot(), contextSource: "unavailable" };
    }
  }

  return allowMock
    ? { snapshot: demoSnapshot(), contextSource: "mock" }
    : { snapshot: unavailableSnapshot(), contextSource: "unavailable" };
}

export const getAdvisorSnapshot = cache(async (): Promise<SnapshotWithSource> => loadSnapshotWithSource());

/** The same load, for anything that must know whether the data is real. */
export const getSnapshotWithSource = getAdvisorSnapshot;

export const getSnapshot = cache(async (): Promise<HavenWorkspaceSnapshot> => {
  if (hasSupabaseEnv) {
    try {
      return await supabaseHavenRepository.getSnapshot();
    } catch {
      return mockSnapshot();
    }
  }

  return mockSnapshot();
});

export const getAppShellSnapshot = cache(async (): Promise<AppShellSnapshot> => {
  if (hasSupabaseEnv) {
    try {
      return await getSupabaseShellSnapshot();
    } catch {
      return shellFromMock();
    }
  }

  return shellFromMock();
});

export const getDashboardPageData = cache(async (): Promise<DashboardPageData> => {
  if (hasSupabaseEnv) {
    try {
      return await getSupabaseDashboardPageData();
    } catch {
      return {
        ...shellFromMock(),
        priorityDateIntelligence: null
      };
    }
  }

  return {
    ...shellFromMock(),
    priorityDateIntelligence: null
  };
});

export const getTimelinePageData = cache(async (): Promise<TimelinePageData> => {
  if (hasSupabaseEnv) {
    try {
      return await getSupabaseTimelinePageData();
    } catch {
      return {
        ...shellFromMock(),
        timelineEvents: mockSnapshot().timelineEvents
      };
    }
  }

  return {
    ...shellFromMock(),
    timelineEvents: mockSnapshot().timelineEvents
  };
});

export const getPlannerPageData = cache(async (): Promise<PlannerPageData> => {
  if (hasSupabaseEnv) {
    try {
      return await getSupabasePlannerPageData();
    } catch {
      return {
        ...shellFromMock(),
        planner: mockSnapshot().planner
      };
    }
  }

  return {
    ...shellFromMock(),
    planner: mockSnapshot().planner
  };
});

export const getCommunityPageData = cache(async (): Promise<CommunityPageData> => {
  if (hasSupabaseEnv) {
    try {
      return await getSupabaseCommunityPageData();
    } catch {
      return {
        ...shellFromMock(),
        cohorts: mockSnapshot().cohorts
      };
    }
  }

  return {
    ...shellFromMock(),
    cohorts: mockSnapshot().cohorts
  };
});

export const getPublicCommunityPageData = cache(async (): Promise<PublicCommunityPageData> => {
  if (hasSupabaseEnv) {
    try {
      return await getSupabasePublicCommunityPageData();
    } catch {
      return {
        cohorts: [],
        warRoom: {
          id: "war-room-empty",
          type: "war_room",
          name: "Layoff War Room",
          summary: "Dedicated high-urgency space for users navigating a layoff or grace-period timeline.",
          members: [],
          posts: []
        }
      };
    }
  }

  return {
    cohorts: mockSnapshot().cohorts,
    warRoom: mockSnapshot().warRoom
  };
});

export const getWarRoomPageData = cache(async (): Promise<WarRoomPageData> => {
  if (hasSupabaseEnv) {
    try {
      return await getSupabaseWarRoomPageData();
    } catch {
      return {
        ...shellFromMock(),
        warRoom: mockSnapshot().warRoom
      };
    }
  }

  return {
    ...shellFromMock(),
    warRoom: mockSnapshot().warRoom
  };
});

export const getInboxPageData = cache(async (): Promise<InboxPageData> => {
  if (hasSupabaseEnv) {
    try {
      return await getSupabaseInboxPageData();
    } catch {
      return {
        ...shellFromMock(),
        documents: mockSnapshot().documents,
        emailAlias: mockSnapshot().emailAlias,
        emailInbox: mockSnapshot().emailInbox,
        emailThreads: mockSnapshot().emailThreads,
        emailContacts: mockSnapshot().emailContacts
      };
    }
  }

  return {
    ...shellFromMock(),
    documents: mockSnapshot().documents,
    emailAlias: mockSnapshot().emailAlias,
    emailInbox: mockSnapshot().emailInbox,
    emailThreads: mockSnapshot().emailThreads,
    emailContacts: mockSnapshot().emailContacts
  };
});

export async function markCommunitySeen() {
  if (!hasSupabaseEnv) {
    return;
  }

  try {
    await markSupabaseCommunitySeen();
  } catch {
    // Best-effort read marker; page rendering should not fail if this update is unavailable.
  }
}
