import { cache } from "react";

import { hasSupabaseEnv } from "@/lib/env";
import { havenSnapshot } from "@/lib/repositories/mock-data";
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
function mockSnapshot(): HavenWorkspaceSnapshot {
  return resolveTestPersona()?.snapshot ?? havenSnapshot;
}

function shellFromMock(): AppShellSnapshot {
  return {
    communityUnreadCount: 0,
    profile: mockSnapshot().profile,
    dashboard: mockSnapshot().dashboard
  };
}

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
