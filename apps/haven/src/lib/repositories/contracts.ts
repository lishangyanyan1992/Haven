import type { HavenWorkspaceSnapshot } from "@/types/domain";

export interface HavenRepository {
  getSnapshot(): Promise<HavenWorkspaceSnapshot>;
}
