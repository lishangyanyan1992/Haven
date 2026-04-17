import { cache } from "react";

import { hasSupabaseEnv } from "@/lib/env";
import { havenSnapshot } from "@/lib/repositories/mock-data";
import {
  getSupabaseCommunityPageData,
  getSupabaseDashboardPageData,
  getSupabaseInboxPageData,
  getSupabasePlannerPageData,
  getSupabaseShellSnapshot,
  getSupabaseTimelinePageData,
  getSupabaseWarRoomPageData,
  supabaseHavenRepository
} from "@/lib/repositories/supabase-case-compass";
import type { HavenWorkspaceSnapshot, PriorityDateIntelligence } from "@/types/domain";

export type AppShellSnapshot = Pick<HavenWorkspaceSnapshot, "profile" | "dashboard">;
export type DashboardPageData = AppShellSnapshot & { priorityDateIntelligence: PriorityDateIntelligence | null };
export type TimelinePageData = AppShellSnapshot & Pick<HavenWorkspaceSnapshot, "timelineEvents">;
export type PlannerPageData = AppShellSnapshot & Pick<HavenWorkspaceSnapshot, "planner">;
export type CommunityPageData = AppShellSnapshot & Pick<HavenWorkspaceSnapshot, "cohorts">;
export type WarRoomPageData = AppShellSnapshot & Pick<HavenWorkspaceSnapshot, "warRoom">;
export type InboxPageData = AppShellSnapshot &
  Pick<HavenWorkspaceSnapshot, "documents" | "emailAlias" | "emailInbox" | "emailThreads" | "emailContacts">;

function shellFromMock(): AppShellSnapshot {
  return {
    profile: havenSnapshot.profile,
    dashboard: havenSnapshot.dashboard
  };
}

export const getSnapshot = cache(async (): Promise<HavenWorkspaceSnapshot> => {
  if (hasSupabaseEnv) {
    try {
      return await supabaseHavenRepository.getSnapshot();
    } catch {
      return havenSnapshot;
    }
  }

  return havenSnapshot;
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
        timelineEvents: havenSnapshot.timelineEvents
      };
    }
  }

  return {
    ...shellFromMock(),
    timelineEvents: havenSnapshot.timelineEvents
  };
});

export const getPlannerPageData = cache(async (): Promise<PlannerPageData> => {
  if (hasSupabaseEnv) {
    try {
      return await getSupabasePlannerPageData();
    } catch {
      return {
        ...shellFromMock(),
        planner: havenSnapshot.planner
      };
    }
  }

  return {
    ...shellFromMock(),
    planner: havenSnapshot.planner
  };
});

export const getCommunityPageData = cache(async (): Promise<CommunityPageData> => {
  if (hasSupabaseEnv) {
    try {
      return await getSupabaseCommunityPageData();
    } catch {
      return {
        ...shellFromMock(),
        cohorts: havenSnapshot.cohorts
      };
    }
  }

  return {
    ...shellFromMock(),
    cohorts: havenSnapshot.cohorts
  };
});

export const getWarRoomPageData = cache(async (): Promise<WarRoomPageData> => {
  if (hasSupabaseEnv) {
    try {
      return await getSupabaseWarRoomPageData();
    } catch {
      return {
        ...shellFromMock(),
        warRoom: havenSnapshot.warRoom
      };
    }
  }

  return {
    ...shellFromMock(),
    warRoom: havenSnapshot.warRoom
  };
});

export const getInboxPageData = cache(async (): Promise<InboxPageData> => {
  if (hasSupabaseEnv) {
    try {
      return await getSupabaseInboxPageData();
    } catch {
      return {
        ...shellFromMock(),
        documents: havenSnapshot.documents,
        emailAlias: havenSnapshot.emailAlias,
        emailInbox: havenSnapshot.emailInbox,
        emailThreads: havenSnapshot.emailThreads,
        emailContacts: havenSnapshot.emailContacts
      };
    }
  }

  return {
    ...shellFromMock(),
    documents: havenSnapshot.documents,
    emailAlias: havenSnapshot.emailAlias,
    emailInbox: havenSnapshot.emailInbox,
    emailThreads: havenSnapshot.emailThreads,
    emailContacts: havenSnapshot.emailContacts
  };
});
