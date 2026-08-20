/**
 * Routes parked during the August 2026 simplification.
 *
 * The product is being narrowed to one thing: ask a question, get an answer
 * built from what the community has actually been through. Everything below is
 * still in the codebase — it is switched off at the edge, not deleted, so any
 * of it can come back by deleting a line from this list.
 *
 * Public content that earns search traffic (blog, guides, resources, tools,
 * jobs, day-1-cpt-schools) is deliberately NOT archived.
 */
export type ArchivedRoute = {
  /** Path prefix that is switched off, including everything under it. */
  prefix: string;
  /** What a person called this surface. */
  label: string;
  /** Why it was parked, so the decision is readable a year from now. */
  reason: string;
};

export const ARCHIVED_ON = "2026-08-19";

export const archivedRoutes: ArchivedRoute[] = [
  {
    prefix: "/dashboard",
    label: "Dashboard",
    reason: "Landing on a wall of cards competes with the one question we want people to ask. The chat is the home screen now."
  },
  {
    prefix: "/planner",
    label: "Layoff planner checklist",
    reason: "The layoff moment is handled inside the chat instead of a separate checklist. Revive if answers alone prove too thin to act on."
  },
  {
    prefix: "/timeline",
    label: "Case timeline",
    reason: "Long-term planning is deliberately phase two, after the stressful-moment answers are good."
  },
  {
    prefix: "/inbox",
    label: "Document vault / email import",
    reason: "Useful, but it asks for work up front. Parked until the chat is worth signing up for on its own."
  },
  {
    prefix: "/profile/community",
    label: "Community feed (signed in)",
    reason: "Community knowledge now reaches people through answers, not through a feed they have to read."
  },
  {
    prefix: "/community",
    label: "Community browse, insights, contribute, war room",
    reason: "Same reason as the feed. The import pipeline behind it keeps running — it feeds the chat."
  },
  {
    prefix: "/cases",
    label: "Cases",
    reason: "Unused surface from an earlier direction."
  },
  {
    prefix: "/clients",
    label: "Clients",
    reason: "Unused surface from an earlier direction."
  },
  {
    prefix: "/documents",
    label: "Documents",
    reason: "Unused surface from an earlier direction."
  },
  {
    prefix: "/reports",
    label: "Reports",
    reason: "Unused surface from an earlier direction."
  },
  {
    prefix: "/tasks",
    label: "Tasks",
    reason: "Unused surface from an earlier direction."
  },
  {
    prefix: "/search",
    label: "Search",
    reason: "The chat is the search box now."
  }
];

const archivedPrefixes = archivedRoutes.map((route) => route.prefix);

export function isArchivedPath(path: string) {
  return archivedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Where a signed-in person belongs now that the dashboard is parked. */
export const SIGNED_IN_HOME = "/advisor";
